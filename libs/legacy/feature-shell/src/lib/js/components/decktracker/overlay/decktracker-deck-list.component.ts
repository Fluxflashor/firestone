import {
	AfterContentInit,
	ChangeDetectionStrategy,
	ChangeDetectorRef,
	Component,
	ElementRef,
	EventEmitter,
	HostListener,
	Input,
	OnDestroy,
	Optional,
	Output,
	ViewRef,
} from '@angular/core';
import { DeckDefinition, encode } from '@firestone-hs/deckstrings';
import { GameFormat } from '@firestone-hs/reference-data';
import { CardTooltipPositionType } from '@firestone/shared/common/view';
import { groupByFunction } from '@firestone/shared/framework/common';
import { CardsFacadeService } from '@firestone/shared/framework/core';
import { DeckCard } from '@legacy-import/src/lib/js/models/decktracker/deck-card';
import { getDefaultHeroDbfIdForClass } from '@legacy-import/src/lib/js/services/hs-utils';
import { VisualDeckCard } from '@models/decktracker/visual-deck-card';
import { BehaviorSubject, Observable, Subscription } from 'rxjs';
import { DeckState } from '../../../models/decktracker/deck-state';
import { SetCard } from '../../../models/set';
import { AppUiStoreFacadeService } from '../../../services/ui-store/app-ui-store-facade.service';
import { AbstractSubscriptionStoreComponent } from '../../abstract-subscription-store.component';

@Component({
	selector: 'decktracker-deck-list',
	styleUrls: [
		`../../../../css/global/scrollbar-decktracker-overlay.scss`,
		'../../../../css/global/scrollbar-cards-list.scss',
		'../../../../css/component/decktracker/overlay/dim-overlay.scss',
		'../../../../css/component/decktracker/overlay/decktracker-deck-list.component.scss',
	],
	template: `
		<dk-runes [deckstring]="deckstring$ | async" [showRunes]="showDkRunes"></dk-runes>
		<ng-scrollbar
			class="deck-list"
			[ngClass]="{ active: isScroll }"
			[autoHeightDisabled]="false"
			[sensorDisabled]="false"
			scrollable
		>
			<ng-container [ngSwitch]="displayMode">
				<!-- <div class="list-background"></div> -->
				<deck-list-by-zone
					*ngSwitchCase="'DISPLAY_MODE_ZONE'"
					[deckState]="deckState$ | async"
					[colorManaCost]="colorManaCost"
					[showRelatedCards]="showRelatedCards"
					[showUnknownCards]="showUnknownCards"
					[showUpdatedCost]="showUpdatedCost"
					[showGlobalEffectsZone]="showGlobalEffectsZone"
					[showGiftsSeparately]="showGiftsSeparately"
					[showStatsChange]="showStatsChange"
					[hideGeneratedCardsInOtherZone]="hideGeneratedCardsInOtherZone"
					[sortCardsByManaCostInOtherZone]="sortCardsByManaCostInOtherZone"
					[showTopCardsSeparately]="showTopCardsSeparately"
					[showBottomCardsSeparately]="showBottomCardsSeparately"
					[tooltipPosition]="_tooltipPosition"
					[darkenUsedCards]="darkenUsedCards"
					[showTotalCardsInZone]="showTotalCardsInZone"
					[side]="side"
				>
				</deck-list-by-zone>
				<grouped-deck-list
					*ngSwitchCase="'DISPLAY_MODE_GROUPED'"
					[deckState]="deckState$ | async"
					[colorManaCost]="colorManaCost"
					[showRelatedCards]="showRelatedCards"
					[showUnknownCards]="showUnknownCards"
					[showUpdatedCost]="showUpdatedCost"
					[showGiftsSeparately]="showGiftsSeparately"
					[showStatsChange]="showStatsChange"
					[cardsGoToBottom]="cardsGoToBottom"
					[tooltipPosition]="_tooltipPosition"
					[showTopCardsSeparately]="showTopCardsSeparately"
					[showBottomCardsSeparately]="showBottomCardsSeparately"
					[hideGeneratedCardsInOtherZone]="hideGeneratedCardsInOtherZone"
					[side]="side"
					[showTotalCardsInZone]="showTotalCardsInZone"
					[collection]="collection"
					(cardClicked)="onCardClicked($event)"
				>
				</grouped-deck-list>
			</ng-container>
		</ng-scrollbar>
	`,
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DeckTrackerDeckListComponent
	extends AbstractSubscriptionStoreComponent
	implements AfterContentInit, OnDestroy
{
	deckstring$: Observable<string>;
	deckState$: Observable<DeckState>;

	@Output() cardClicked: EventEmitter<VisualDeckCard> = new EventEmitter<VisualDeckCard>();

	@Input() displayMode: string;
	@Input() colorManaCost: boolean;
	@Input() showRelatedCards: boolean;
	@Input() showUpdatedCost: boolean;
	@Input() showGlobalEffectsZone: boolean;
	@Input() showGiftsSeparately: boolean;
	@Input() showStatsChange: boolean;
	@Input() showUnknownCards: boolean;
	@Input() cardsGoToBottom: boolean;
	@Input() darkenUsedCards: boolean;
	@Input() hideGeneratedCardsInOtherZone: boolean;
	@Input() sortCardsByManaCostInOtherZone: boolean;
	@Input() showBottomCardsSeparately: boolean;
	@Input() showTopCardsSeparately: boolean;
	@Input() showDkRunes: boolean;
	@Input() showTotalCardsInZone: boolean;
	@Input() side: 'player' | 'opponent' | 'duels';
	@Input() collection: readonly SetCard[];
	@Input() set tooltipPosition(value: CardTooltipPositionType) {
		this._tooltipPosition = value;
	}
	@Input() set deckState(deckState: DeckState) {
		// this._deckState = deckState;
		this.deckState$$.next(deckState);
		// console.debug('setting deckstate', this.deckState$$.value);
		this.refreshScroll();
	}

	_tooltipPosition: CardTooltipPositionType;
	// _deckState: DeckState;
	isScroll: boolean;

	private sub$$: Subscription;
	private deckState$$ = new BehaviorSubject<DeckState>(null);

	constructor(
		@Optional() protected readonly store: AppUiStoreFacadeService,
		protected readonly cdr: ChangeDetectorRef,
		private el: ElementRef,
		private readonly allCards: CardsFacadeService,
	) {
		super(store, cdr);
	}

	ngAfterContentInit() {
		this.sub$$ = this.store
			?.listenPrefs$((prefs) => prefs.decktrackerScale)
			.pipe(this.mapData(([pref]) => pref))
			.subscribe((scale) => this.refreshScroll());
		this.deckState$ = this.deckState$$.asObservable();
		this.deckstring$ = this.deckState$$.asObservable().pipe(
			this.mapData((deckState) => {
				if (deckState.deckstring) {
					return deckState.deckstring;
				}

				if (!deckState?.hero?.cardId) {
					console.warn('no hero id', deckState?.hero);
				}

				// Extract all cards that were initially present in the deck
				const cardsFromInitialDeck = [
					...deckState.deck,
					...deckState.deckList,
					...deckState.hand,
					...deckState.board,
					...deckState.otherZone,
				]
					.filter((c) => !!c.cardId)
					.filter((c) => !c.creatorCardId)
					.filter((c) => !c.stolenFromOpponent)
					.filter((c) => !c.temporaryCard);
				let heroCardId = !!deckState?.hero?.cardId ? this.allCards.getCard(deckState?.hero?.cardId).dbfId : 7;
				if (!heroCardId) {
					const classCards = cardsFromInitialDeck
						.map((c) => this.allCards.getCard(c.cardId).cardClass)
						.filter((c) => !!c);
					heroCardId = getDefaultHeroDbfIdForClass(classCards[0]);
				}
				const groupedCards = groupByFunction((c: DeckCard) => c.cardId)(cardsFromInitialDeck);
				const deckDefinition: DeckDefinition = {
					cards: Object.values(groupedCards).map((cards) => [
						this.allCards.getCard(cards[0].cardId).dbfId,
						cards.length,
					]),
					heroes: [heroCardId],
					format: GameFormat.FT_WILD,
					sideboards: !deckState.sideboards?.length
						? null
						: deckState.sideboards.map((sideboard) => {
								return {
									keyCardDbfId: this.allCards.getCard(sideboard.keyCardId).dbfId,
									cards: Object.values(
										groupByFunction((cardId: string) => cardId)(sideboard.cards),
									).map((cardIds) => [this.allCards.getCard(cardIds[0]).dbfId, cardIds.length]),
								};
						  }),
				};
				return encode(deckDefinition);
			}),
		);
	}

	@HostListener('window:beforeunload')
	ngOnDestroy() {
		super.ngOnDestroy();
		this.sub$$?.unsubscribe();
	}

	onCardClicked(card: VisualDeckCard) {
		this.cardClicked.next(card);
	}

	private refreshScroll() {
		setTimeout(() => {
			const psContent = this.el.nativeElement.querySelector('.ps-content');
			const ps = this.el.nativeElement.querySelector('.ps');
			if (!ps || !psContent) {
				return;
			}
			const contentHeight = psContent.getBoundingClientRect().height;
			const containerHeight = ps.getBoundingClientRect().height;
			this.isScroll = contentHeight > containerHeight;
			if (!(this.cdr as ViewRef)?.destroyed) {
				this.cdr.detectChanges();
			}
		}, 1000);
	}
}
