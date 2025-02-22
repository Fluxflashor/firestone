import {
	AfterContentInit,
	ChangeDetectionStrategy,
	ChangeDetectorRef,
	Component,
	ElementRef,
	OnDestroy,
	Renderer2,
	ViewEncapsulation,
} from '@angular/core';
import {
	BUDDIES_TRIBE_REQUIREMENTS,
	CardIds,
	GameTag,
	NON_DISCOVERABLE_BUDDIES,
	normalizeHeroCardId,
	Race,
	ReferenceCard,
} from '@firestone-hs/reference-data';
import { CardsFacadeService } from '@firestone/shared/framework/core';
import { combineLatest, Observable } from 'rxjs';
import { getAllCardsInGame, getBuddy, getEffectiveTribes } from '../../../services/battlegrounds/bgs-utils';
import { DebugService } from '../../../services/debug.service';
import { LocalizationFacadeService } from '../../../services/localization-facade.service';
import { AppUiStoreFacadeService } from '../../../services/ui-store/app-ui-store-facade.service';
import { groupByFunction } from '../../../services/utils';
import { AbstractSubscriptionStoreComponent } from '../../abstract-subscription-store.component';
import { Tier } from './battlegrounds-minions-tiers-view.component';

@Component({
	selector: 'battlegrounds-minions-tiers',
	styleUrls: [
		`../../../../css/global/cdk-overlay.scss`,
		`../../../../css/themes/battlegrounds-theme.scss`,
		'../../../../css/component/battlegrounds/minions-tiers/battlegrounds-minions-tiers.component.scss',
	],
	template: `
		<div class="battlegrounds-minions-tiers scalable battlegrounds-theme">
			<battlegrounds-minions-tiers-view
				[tiers]="tiers$ | async"
				[currentTurn]="currentTurn$ | async"
				[tavernTier]="tavernTier$ | async"
				[showMinionsList]="showMinionsList$ | async"
				[showTribesHighlight]="showTribesHighlight$ | async"
				[showBattlecryHighlight]="showBattlecryHighlight$ | async"
				[highlightedMinions]="highlightedMinions$ | async"
				[highlightedTribes]="highlightedTribes$ | async"
				[highlightedMechanics]="highlightedMechanics$ | async"
				[enableMouseOver]="enableMouseOver$ | async"
				[showGoldenCards]="showGoldenCards$ | async"
				[showTurnNumber]="showTurnNumber$ | async"
			></battlegrounds-minions-tiers-view>
		</div>
	`,
	changeDetection: ChangeDetectionStrategy.OnPush,
	encapsulation: ViewEncapsulation.None, // Needed to the cdk overlay styling to work
})
export class BattlegroundsMinionsTiersOverlayComponent
	extends AbstractSubscriptionStoreComponent
	implements AfterContentInit, OnDestroy
{
	private static readonly WINDOW_WIDTH = 1300;

	tiers$: Observable<readonly Tier[]>;
	highlightedTribes$: Observable<readonly Race[]>;
	highlightedMechanics$: Observable<readonly GameTag[]>;
	highlightedMinions$: Observable<readonly string[]>;
	currentTurn$: Observable<number>;
	tavernTier$: Observable<number>;
	showTribesHighlight$: Observable<boolean>;
	showBattlecryHighlight$: Observable<boolean>;
	showMinionsList$: Observable<boolean>;
	showTurnNumber$: Observable<boolean>;
	enableMouseOver$: Observable<boolean>;
	showGoldenCards$: Observable<boolean>;

	constructor(
		protected readonly store: AppUiStoreFacadeService,
		protected readonly cdr: ChangeDetectorRef,
		private readonly init_DebugService: DebugService,
		private readonly allCards: CardsFacadeService,
		private readonly el: ElementRef,
		private readonly renderer: Renderer2,
		private readonly i18n: LocalizationFacadeService,
	) {
		super(store, cdr);
	}

	ngAfterContentInit() {
		this.tiers$ = combineLatest([
			this.store.listenPrefs$(
				(prefs) => prefs.bgsShowMechanicsTiers,
				(prefs) => prefs.bgsGroupMinionsIntoTheirTribeGroup,
			),
			this.store.listenBattlegrounds$(
				([main, prefs]) => main?.currentGame?.availableRaces,
				([main, prefs]) => main?.currentGame?.hasBuddies,
				([main, prefs]) => main?.currentGame?.getMainPlayer()?.cardId,
				([main, prefs]) => main?.currentGame?.players?.map((p) => p.cardId),
			),
		]).pipe(
			this.mapData(
				([
					[showMechanicsTiers, bgsGroupMinionsIntoTheirTribeGroup],
					[races, hasBuddies, playerCardId, allPlayersCardIds],
				]) => {
					const normalizedCardId = normalizeHeroCardId(playerCardId, this.allCards);
					const allPlayerCardIds = allPlayersCardIds?.map((p) => normalizeHeroCardId(p, this.allCards)) ?? [];
					const ownBuddyId = hasBuddies ? getBuddy(normalizedCardId as CardIds, this.allCards) : null;
					const ownBuddy = !!ownBuddyId ? this.allCards.getCard(ownBuddyId) : null;
					const cardsInGame = getAllCardsInGame(races, this.allCards);
					const cardsToIncludes = !!ownBuddy ? [...cardsInGame, ownBuddy] : cardsInGame;
					const result = this.buildTiers(
						cardsToIncludes,
						bgsGroupMinionsIntoTheirTribeGroup,
						showMechanicsTiers,
						races,
						normalizedCardId,
						allPlayerCardIds,
					);
					return result;
				},
			),
		);
		this.highlightedTribes$ = this.store
			.listenBattlegrounds$(([main, prefs]) => main.highlightedTribes)
			.pipe(this.mapData(([tribes]) => tribes));
		this.highlightedMechanics$ = this.store
			.listenBattlegrounds$(([main, prefs]) => main.highlightedMechanics)
			.pipe(this.mapData(([highlightedMechanics]) => highlightedMechanics));
		this.highlightedMinions$ = this.store
			.listenBattlegrounds$(([main, prefs]) => main.highlightedMinions)
			.pipe(this.mapData(([tribes]) => tribes));
		this.currentTurn$ = this.store
			.listenBattlegrounds$(([main, prefs]) => main.currentGame?.currentTurn)
			.pipe(this.mapData(([currentTurn]) => currentTurn));
		this.tavernTier$ = this.store
			.listenBattlegrounds$(([main, prefs]) => main.currentGame?.getMainPlayer()?.getCurrentTavernTier())
			.pipe(this.mapData(([tavernTier]) => tavernTier));
		this.showTribesHighlight$ = this.listenForBasicPref$((prefs) => prefs.bgsShowTribesHighlight);
		this.showBattlecryHighlight$ = this.listenForBasicPref$((prefs) => prefs.bgsShowMechanicsHighlight);
		this.showMinionsList$ = this.listenForBasicPref$((prefs) => prefs.bgsEnableMinionListOverlay);
		this.showTurnNumber$ = this.listenForBasicPref$((prefs) => prefs.bgsEnableTurnNumbertOverlay);
		this.enableMouseOver$ = this.listenForBasicPref$((prefs) => prefs.bgsEnableMinionListMouseOver);
		this.showGoldenCards$ = this.listenForBasicPref$((prefs) => prefs.bgsMinionListShowGoldenCard);
		this.listenForBasicPref$((prefs) => prefs.bgsMinionsListScale).subscribe((scale) => {
			// this.el.nativeElement.style.setProperty('--bgs-banned-tribe-scale', scale / 100);
			const element = this.el.nativeElement.querySelector('.scalable');
			this.renderer.setStyle(element, 'transform', `scale(${scale / 100})`);
		});
	}

	private buildTiers(
		cardsInGame: readonly ReferenceCard[],
		groupMinionsIntoTheirTribeGroup: boolean,
		showMechanicsTiers: boolean,
		availableTribes: readonly Race[],
		playerCardId: string,
		allPlayerCardIds: readonly string[],
	): readonly Tier[] {
		if (!cardsInGame?.length) {
			return [];
		}

		const groupedByTier: { [tierLevel: string]: readonly ReferenceCard[] } = groupByFunction(
			(card: ReferenceCard) => '' + card.techLevel,
		)(cardsInGame);
		const standardTiers: readonly Tier[] = Object.keys(groupedByTier).map((tierLevel) => ({
			tavernTier: parseInt(tierLevel),
			cards: groupedByTier[tierLevel],
			groupingFunction: (card: ReferenceCard) =>
				getEffectiveTribes(card, groupMinionsIntoTheirTribeGroup).filter(
					(t) =>
						!availableTribes?.length ||
						availableTribes.includes(Race[t]) ||
						Race[t] === Race.BLANK ||
						Race[t] === Race.ALL,
				),
			type: 'standard',
		}));
		const mechanicsTiers = showMechanicsTiers
			? this.buildMechanicsTiers(cardsInGame, playerCardId, availableTribes, allPlayerCardIds)
			: [];
		return [...standardTiers, ...mechanicsTiers];
	}

	private buildMechanicsTiers(
		cardsInGame: readonly ReferenceCard[],
		playerCardId: string,
		availableTribes: readonly Race[],
		allPlayerCardIds: readonly string[],
	): readonly Tier[] {
		const mechanicalTiers: Tier[] = [
			{
				tavernTier: 'B',
				cards: cardsInGame.filter((c) => c.mechanics?.includes(GameTag[GameTag.BATTLECRY])),
				groupingFunction: (card: ReferenceCard) => ['' + card.techLevel],
				tooltip: this.i18n.translateString('battlegrounds.in-game.minions-list.mechanics-tier-tooltip', {
					value: this.i18n.translateString(`global.mechanics.${GameTag[GameTag.BATTLECRY].toLowerCase()}`),
				}),
				type: 'mechanics',
			},
			{
				tavernTier: 'D',
				cards: cardsInGame.filter((c) => c.mechanics?.includes(GameTag[GameTag.DEATHRATTLE])),
				groupingFunction: (card: ReferenceCard) => ['' + card.techLevel],
				tooltip: this.i18n.translateString('battlegrounds.in-game.minions-list.mechanics-tier-tooltip', {
					value: this.i18n.translateString(`global.mechanics.${GameTag[GameTag.DEATHRATTLE].toLowerCase()}`),
				}),
				type: 'mechanics',
			},
			{
				tavernTier: 'DS',
				cards: [
					...cardsInGame.filter((c) => c.mechanics?.includes(GameTag[GameTag.DIVINE_SHIELD])),
					cardsInGame.find((c) => c.id === CardIds.Glowscale),
				],
				groupingFunction: (card: ReferenceCard) => ['' + card.techLevel],
				tooltip: this.i18n.translateString('battlegrounds.in-game.minions-list.mechanics-tier-tooltip', {
					value: this.i18n.translateString(
						`global.mechanics.${GameTag[GameTag.DIVINE_SHIELD].toLowerCase()}`,
					),
				}),
				type: 'mechanics',
			},
			{
				tavernTier: 'T',
				cards: cardsInGame.filter((c) => c.mechanics?.includes(GameTag[GameTag.TAUNT])),
				groupingFunction: (card: ReferenceCard) => ['' + card.techLevel],
				tooltip: this.i18n.translateString('battlegrounds.in-game.minions-list.mechanics-tier-tooltip', {
					value: this.i18n.translateString(`global.mechanics.${GameTag[GameTag.TAUNT].toLowerCase()}`),
				}),
				type: 'mechanics',
			},
			{
				tavernTier: 'E',
				cards: cardsInGame.filter((c) => c.mechanics?.includes(GameTag[GameTag.END_OF_TURN])),
				groupingFunction: (card: ReferenceCard) => ['' + card.techLevel],
				tooltip: this.i18n.translateString('battlegrounds.in-game.minions-list.mechanics-tier-tooltip', {
					value: this.i18n.translateString(`global.mechanics.${GameTag[GameTag.END_OF_TURN].toLowerCase()}`),
				}),
				type: 'mechanics',
			},
			{
				tavernTier: 'R',
				cards: cardsInGame.filter((c) => c.mechanics?.includes(GameTag[GameTag.REBORN])),
				groupingFunction: (card: ReferenceCard) => ['' + card.techLevel],
				tooltip: this.i18n.translateString('battlegrounds.in-game.minions-list.mechanics-tier-tooltip', {
					value: this.i18n.translateString(`global.mechanics.${GameTag[GameTag.REBORN].toLowerCase()}`),
				}),
				type: 'mechanics',
			},
		];
		// Add a tier with all the buddies
		if (
			[
				CardIds.ETCBandManager_BG25_HERO_105,
				CardIds.TessGreymaneBattlegrounds,
				CardIds.ScabbsCutterbutter_BG21_HERO_010,
			].includes(playerCardId as CardIds)
		) {
			const allBuddies = this.allCards
				.getCards()
				.filter((c) => !!c.techLevel)
				.filter((c) => !!c.battlegroundsPremiumDbfId)
				.filter((card) => card.set !== 'Vanilla')
				.filter((card) => card.mechanics?.includes(GameTag[GameTag.BACON_BUDDY]));
			const buddies: readonly ReferenceCard[] =
				playerCardId === CardIds.ETCBandManager_BG25_HERO_105
					? allBuddies
							.filter((b) => !NON_DISCOVERABLE_BUDDIES.includes(b.id as CardIds))
							.filter(
								(b) =>
									!BUDDIES_TRIBE_REQUIREMENTS.find((req) => b.id === req.buddy) ||
									availableTribes.includes(
										BUDDIES_TRIBE_REQUIREMENTS.find((req) => b.id === req.buddy).tribe,
									),
							)
					: [CardIds.TessGreymaneBattlegrounds, CardIds.ScabbsCutterbutter_BG21_HERO_010].includes(
							playerCardId as CardIds,
					  )
					? allPlayerCardIds
							.map((p) => getBuddy(p as CardIds, this.allCards))
							.map((b) => this.allCards.getCard(b))
					: [];
			mechanicalTiers.push({
				tavernTier: 'Buds',
				cards: buddies,
				groupingFunction: (card: ReferenceCard) => ['' + card.techLevel],
				tooltip: this.i18n.translateString('battlegrounds.in-game.minions-list.buddies-tier-tooltip'),
				type: 'mechanics',
			});
		}

		return mechanicalTiers;
	}
}
