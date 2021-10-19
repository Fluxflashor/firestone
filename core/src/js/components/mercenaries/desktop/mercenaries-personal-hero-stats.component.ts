import { ChangeDetectionStrategy, ChangeDetectorRef, Component, Input, ViewRef } from '@angular/core';
import { RarityTYpe, TaskStatus } from '@firestone-hs/reference-data';
import { combineLatest, Observable } from 'rxjs';
import { distinctUntilChanged, filter, map, tap } from 'rxjs/operators';
import {
	MercenariesPersonalHeroesSortCriteria,
	MercenariesPersonalHeroesSortCriteriaType,
} from '../../../models/mercenaries/personal-heroes-sort-criteria.type';
import { CardsFacadeService } from '../../../services/cards-facade.service';
import { MercenariesPersonalHeroesSortEvent } from '../../../services/mainwindow/store/events/mercenaries/mercenaries-personal-heroes-sort-event';
import { getHeroRole, normalizeMercenariesCardId } from '../../../services/mercenaries/mercenaries-utils';
import { OverwolfService } from '../../../services/overwolf.service';
import { AppUiStoreService, cdLog } from '../../../services/ui-store/app-ui-store.service';
import { areDeepEqual, sumOnArray } from '../../../services/utils';

@Component({
	selector: 'mercenaries-personal-hero-stats',
	styleUrls: [
		`../../../../css/global/components-global.scss`,
		`../../../../css/component/mercenaries/desktop/mercenaries-personal-hero-stats.component.scss`,
	],
	template: `
		<div class="mercenaries-personal-hero-stats" *ngIf="stats$ | async as stats; else emptyState">
			<div class="header" *ngIf="sortCriteria$ | async as sort">
				<sortable-label class="level" [name]="'Lvl'" [sort]="sort" [criteria]="'level'"> </sortable-label>
				<sortable-label class="role" [name]="'Role'" [sort]="sort" [criteria]="'role'"> </sortable-label>
				<sortable-label class="name" [name]="'Name'" [sort]="sort" [criteria]="'name'"> </sortable-label>
				<sortable-label class="xp" [name]="'Xp'" [sort]="sort" [criteria]="'xp-in-level'"> </sortable-label>
				<sortable-label
					class="coins left"
					[name]="'Coins Left'"
					[sort]="sort"
					[criteria]="'coins-left'"
					helpTooltip="Total coins you have in reserve for this merc"
				>
				</sortable-label>
				<sortable-label
					class="coins needed"
					[name]="'Coins Needed'"
					[sort]="sort"
					[criteria]="'coins-needed-to-max'"
					helpTooltip="Total coins you need to spend to fully max out this merc"
				>
				</sortable-label>
				<sortable-label
					class="tasks"
					[name]="'Task progress'"
					[sort]="sort"
					[criteria]="'task-progress'"
					helpTooltip="The current task. Task 18 is the final one for all mercs"
				>
				</sortable-label>
				<sortable-label class="abilities" [name]="'Abilities'" [isSortable]="false"> </sortable-label>
				<sortable-label class="equipments" [name]="'Equipments'" [isSortable]="false"> </sortable-label>
			</div>
			<div class="list" scrollable>
				<mercenaries-personal-hero-stat
					*ngFor="let stat of stats; trackBy: trackByFn"
					[stat]="stat"
				></mercenaries-personal-hero-stat>
			</div>
		</div>
		<ng-template #emptyState>
			<mercenaries-empty-state
				[subtitle]="'Go to the Mercenaries Village screen in Hearthstone to refresh the information'"
			></mercenaries-empty-state
		></ng-template>
	`,
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MercenariesPersonalHeroStatsComponent {
	stats$: Observable<readonly PersonalHeroStat[]>;
	sortCriteria$: Observable<MercenariesPersonalHeroesSortCriteria>;

	private unsortedStats$: Observable<readonly PersonalHeroStat[]>;

	constructor(
		private readonly ow: OverwolfService,
		private readonly store: AppUiStoreService,
		private readonly cdr: ChangeDetectorRef,
		private readonly allCards: CardsFacadeService,
	) {
		this.sortCriteria$ = this.store
			.listen$(([main, nav, prefs]) => prefs.mercenariesPersonalHeroesSortCriteria)
			.pipe(
				map(([sortCriteria]) => sortCriteria[0]),
				tap((filter) => setTimeout(() => this.cdr?.detectChanges(), 0)),
				tap((info) => cdLog('emitting sortCriteria in ', this.constructor.name, info)),
			);
		this.unsortedStats$ = this.store
			.listen$(
				([main, nav]) => main.mercenaries.referenceData,
				([main, nav]) => main.mercenaries.collectionInfo,
			)
			.pipe(
				filter(([referenceData, collectionInfo]) => !!referenceData && !!collectionInfo),
				distinctUntilChanged((a, b) => areDeepEqual(a, b)),
				// tap((info) => console.debug('hop', info)),
				map(([referenceData, collectionInfo]) => {
					return collectionInfo.Mercenaries.map((memMerc) => {
						const refMerc = referenceData.mercenaries.find((m) => m.id === memMerc.Id);
						const mercenaryCard = this.allCards.getCardFromDbfId(refMerc.cardDbfId);
						const taskChain = referenceData.taskChains.find((chain) => chain.mercenaryId === refMerc.id);
						// console.debug('taskChain', refMerc.name, taskChain);
						// Can have only one task per mercenary at the same time
						const visitorInfo = collectionInfo.Visitors.find(
							(v) => v.VisitorId === taskChain.mercenaryVisitorId,
						);
						// console.debug('visitorInfo', visitorInfo);
						const currentTaskStep = visitorInfo?.TaskChainProgress;
						const currentStep = !visitorInfo
							? null
							: visitorInfo.Status === TaskStatus.CLAIMED
							? Math.min(taskChain.tasks.length, currentTaskStep + 1)
							: currentTaskStep;

						const currentTaskDescription =
							currentStep != null
								? [...taskChain.tasks].sort((a, b) => a.id - b.id)[currentStep].description
								: null;
						const lastLevel = [...referenceData.mercenaryLevels].pop();
						const isMaxLevel = memMerc.Level === lastLevel.currentLevel;

						const abilities = refMerc.abilities.map((info) => {
							const abilityCard = this.allCards.getCardFromDbfId(info.cardDbfId);
							const memAbility = memMerc.Abilities.find(
								(a) =>
									normalizeMercenariesCardId(a.CardId) === normalizeMercenariesCardId(abilityCard.id),
							);
							const memAbilityCard = this.allCards.getCard(memAbility?.CardId);
							const refAbility = refMerc.abilities.find((a) => a.abilityId === info.abilityId);
							const currentUnlockedTier = memAbility?.Tier ?? 0;
							const coinsToCraft = refAbility.tiers
								.filter((a) => a.tier > currentUnlockedTier)
								.map((tier) => tier.coinCraftCost)
								.reduce((a, b) => a + b, 0);
							return {
								cardId: memAbilityCard.id ?? abilityCard.id,
								coinsToCraft: coinsToCraft,
								owned: !!memAbility,
								speed: memAbilityCard.cost ?? abilityCard.cost,
								cooldown:
									memAbilityCard.mercenaryAbilityCooldown ?? abilityCard.mercenaryAbilityCooldown,
							};
						});
						const equipments = refMerc.equipments.map((info) => {
							const equipmentCard = this.allCards.getCardFromDbfId(info.cardDbfId);
							const memEquip = memMerc.Equipments.find((e) => e.Id === info.equipmentId);
							const refEquip = refMerc.equipments.find((a) => a.equipmentId === info.equipmentId);
							const currentUnlockedTier = memEquip?.Tier ?? 0;
							const coinsToCraft = refEquip.tiers
								.filter((a) => a.tier > currentUnlockedTier)
								.map((tier) => tier.coinCraftCost)
								.reduce((a, b) => a + b, 0);
							return {
								cardId: equipmentCard.id,
								coinsToCraft: coinsToCraft,
								owned: !!memEquip?.Owned,
								isEquipped: !!memEquip ? memEquip.Equipped : false,
							};
						});
						return {
							mercenaryId: refMerc.id,
							owned: memMerc.Owned,
							cardId: mercenaryCard.id,
							premium: memMerc.Premium,
							rarity: memMerc.Rarity,
							name: mercenaryCard.name,
							role: getHeroRole(mercenaryCard.mercenaryRole),
							currentLevel: memMerc.Level,
							totalXp: memMerc.Experience,
							isMaxLevel: isMaxLevel,
							xpNeededForLevel: isMaxLevel
								? 0
								: memMerc.Level === 30
								? null
								: referenceData.mercenaryLevels.find((info) => info.currentLevel === memMerc.Level + 1)
										?.xpToNext - memMerc.Experience,
							xpInCurrentLevel: isMaxLevel
								? lastLevel.xpToNext
								: memMerc.Level <= 1
								? memMerc.Experience
								: memMerc.Experience -
								  referenceData.mercenaryLevels.find((info) => info.currentLevel === memMerc.Level)
										?.xpToNext,
							abilities: abilities,
							equipments: equipments,
							minCostOfNextUpgrade: null,
							totalCoinsForFullUpgrade:
								sumOnArray(abilities, (a) => a.coinsToCraft) +
								sumOnArray(equipments, (e) => e.coinsToCraft),
							totalCoinsLeft: memMerc.CurrencyAmount,
							totalTasks: taskChain.tasks.length,
							currentTask: currentStep != null ? currentStep + 1 : null,
							currentTaskDescription: currentTaskDescription,
						} as PersonalHeroStat;
					});
				}),
				tap((filter) => setTimeout(() => this.cdr?.detectChanges(), 0)),
				tap((info) => cdLog('emitting stats in ', this.constructor.name, info?.length)),
			);
		this.stats$ = combineLatest(
			this.unsortedStats$,
			this.store.listen$(([main, nav, prefs]) => prefs.mercenariesPersonalHeroesSortCriteria),
		).pipe(
			map(([stats, [sortCriteria]]) => this.sortPersonalHeroStats(stats, sortCriteria)),
			tap((filter) => setTimeout(() => this.cdr?.detectChanges(), 0)),
			tap((info) => cdLog('emitting sorted stats in ', this.constructor.name, info?.length)),
		);
	}

	trackByFn(index: number, item: PersonalHeroStat) {
		return item.mercenaryId;
	}

	private sortPersonalHeroStats(
		stats: readonly PersonalHeroStat[],
		sortCriteria: readonly MercenariesPersonalHeroesSortCriteria[],
	): readonly PersonalHeroStat[] {
		let currentSorted = stats;
		// Most important criteria is first in the list, to applied last
		const reversedCriteria = [...sortCriteria].reverse();
		for (const criteria of reversedCriteria) {
			currentSorted = [...currentSorted].sort(this.applySortCriteria(criteria));
		}
		return currentSorted;
	}

	private applySortCriteria(
		criteria: MercenariesPersonalHeroesSortCriteria,
	): (a: PersonalHeroStat, b: PersonalHeroStat) => number {
		switch (criteria.criteria) {
			case 'level':
				return criteria.direction === 'desc'
					? (a: PersonalHeroStat, b: PersonalHeroStat) => (a.totalXp > b.totalXp ? -1 : 1)
					: (a: PersonalHeroStat, b: PersonalHeroStat) => (a.totalXp < b.totalXp ? -1 : 1);
			case 'role':
				return criteria.direction === 'desc'
					? (a: PersonalHeroStat, b: PersonalHeroStat) => (a.role > b.role ? -1 : 1)
					: (a: PersonalHeroStat, b: PersonalHeroStat) => (a.role < b.role ? -1 : 1);
			case 'name':
				return criteria.direction === 'desc'
					? (a: PersonalHeroStat, b: PersonalHeroStat) => (a.name > b.name ? -1 : 1)
					: (a: PersonalHeroStat, b: PersonalHeroStat) => (a.name < b.name ? -1 : 1);
			case 'xp-in-level':
				return criteria.direction === 'desc'
					? (a: PersonalHeroStat, b: PersonalHeroStat) => (this.progressBar(a) > this.progressBar(b) ? -1 : 1)
					: (a: PersonalHeroStat, b: PersonalHeroStat) =>
							this.progressBar(a) < this.progressBar(b) ? -1 : 1;
			case 'coins-left':
				return criteria.direction === 'desc'
					? (a: PersonalHeroStat, b: PersonalHeroStat) => (a.totalCoinsLeft > b.totalCoinsLeft ? -1 : 1)
					: (a: PersonalHeroStat, b: PersonalHeroStat) => (a.totalCoinsLeft < b.totalCoinsLeft ? -1 : 1);
			case 'coins-needed-to-max':
				return criteria.direction === 'desc'
					? (a: PersonalHeroStat, b: PersonalHeroStat) =>
							a.totalCoinsForFullUpgrade > b.totalCoinsForFullUpgrade ? -1 : 1
					: (a: PersonalHeroStat, b: PersonalHeroStat) =>
							a.totalCoinsForFullUpgrade < b.totalCoinsForFullUpgrade ? -1 : 1;
			case 'task-progress':
				return criteria.direction === 'desc'
					? (a: PersonalHeroStat, b: PersonalHeroStat) => (a.currentTask > b.currentTask ? -1 : 1)
					: (a: PersonalHeroStat, b: PersonalHeroStat) => (a.currentTask < b.currentTask ? -1 : 1);
		}
	}

	private progressBar(a: PersonalHeroStat): number {
		return !!a.xpNeededForLevel ? a.xpInCurrentLevel / a.xpNeededForLevel : -1;
	}
}

@Component({
	selector: 'sortable-label',
	styleUrls: [
		`../../../../css/global/components-global.scss`,
		`../../../../css/component/mercenaries/desktop/sortable-label.component.scss`,
	],
	template: `
		<div
			class="sortable-label"
			[ngClass]="{
				'sortable': _isSortable,
				'active-asc': _sort?.criteria === _criteria && _sort?.direction === 'asc',
				'active-desc': _sort?.criteria === _criteria && _sort?.direction === 'desc'
			}"
			(click)="startSort()"
		>
			<div class="label">
				<span>{{ _name }}</span>
				<svg class="caret svg-icon-fill">
					<use xlink:href="assets/svg/sprite.svg#arrow" />
				</svg>
			</div>
		</div>
	`,
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SortableLabelComponent {
	@Input() set name(value: string) {
		this._name = value;
		if (!(this.cdr as ViewRef)?.destroyed) {
			this.cdr.detectChanges();
		}
	}

	@Input() set criteria(value: MercenariesPersonalHeroesSortCriteriaType) {
		this._criteria = value;
		if (!(this.cdr as ViewRef)?.destroyed) {
			this.cdr.detectChanges();
		}
	}

	@Input() set sort(value: MercenariesPersonalHeroesSortCriteria) {
		this._sort = value;
		if (!(this.cdr as ViewRef)?.destroyed) {
			this.cdr.detectChanges();
		}
	}

	@Input() set isSortable(value: boolean) {
		this._isSortable = value;
		if (!(this.cdr as ViewRef)?.destroyed) {
			this.cdr.detectChanges();
		}
	}

	_name: string;
	_criteria: MercenariesPersonalHeroesSortCriteriaType;
	_isSortable = true;
	_sort: MercenariesPersonalHeroesSortCriteria;

	constructor(private readonly cdr: ChangeDetectorRef, private readonly store: AppUiStoreService) {}

	startSort() {
		if (!this._isSortable) {
			return;
		}
		this.store.send(new MercenariesPersonalHeroesSortEvent(this._criteria));
	}
}

export interface PersonalHeroStat {
	readonly mercenaryId: number;
	readonly cardId: string;
	readonly owned: boolean;
	readonly premium: number;
	readonly name: string;
	readonly rarity: RarityTYpe;
	readonly role: string;
	readonly currentLevel: number;
	readonly isMaxLevel: boolean;
	readonly totalXp: number;
	readonly xpNeededForLevel: number;
	readonly xpInCurrentLevel: number;
	readonly totalCoinsLeft: number;
	readonly totalCoinsForFullUpgrade: number;
	readonly minCostOfNextUpgrade: number;
	readonly abilities: readonly PersonalHeroStatAbility[];
	readonly equipments: readonly PersonalHeroStatEquipment[];
	readonly totalTasks: number;
	readonly currentTask: number;
	readonly currentTaskDescription: string;
}

export interface PersonalHeroStatAbility {
	readonly cardId: string;
	readonly owned: boolean;
	readonly speed: number;
	readonly cooldown: number;
}

export interface PersonalHeroStatEquipment {
	readonly cardId: string;
	readonly owned: boolean;
	readonly isEquipped: boolean;
}
