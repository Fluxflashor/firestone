import { AfterContentInit, ChangeDetectionStrategy, ChangeDetectorRef, Component } from '@angular/core';
import { DuelsHeroSortFilterType, DuelsMetaStats } from '@firestone/duels/view';
import { CardsFacadeService } from '@firestone/shared/framework/core';
import { Observable } from 'rxjs';
import { AppUiStoreFacadeService } from '../../../services/ui-store/app-ui-store-facade.service';
import { AbstractSubscriptionStoreComponent } from '../../abstract-subscription-store.component';

@Component({
	selector: 'duels-hero-stats',
	styleUrls: [`../../../../css/component/duels/desktop/duels-hero-stats.component.scss`],
	template: `
		<div *ngIf="stats$ | async as stats; else emptyState" class="duels-hero-stats" scrollable>
			<duels-meta-stats-view
				[stats]="stats"
				[sort]="sort$ | async"
				[hideLowData]="hideLowData$ | async"
			></duels-meta-stats-view>
		</div>
		<ng-template #emptyState>
			<duels-empty-state></duels-empty-state>
		</ng-template>
	`,
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DuelsHeroStatsComponent extends AbstractSubscriptionStoreComponent implements AfterContentInit {
	stats$: Observable<readonly DuelsMetaStats[]>;
	sort$: Observable<DuelsHeroSortFilterType>;
	hideLowData$: Observable<boolean>;

	constructor(
		private readonly allCards: CardsFacadeService,
		protected readonly store: AppUiStoreFacadeService,
		protected readonly cdr: ChangeDetectorRef,
	) {
		super(store, cdr);
	}

	ngAfterContentInit() {
		this.stats$ = this.store.duelsHeroStats$().pipe(
			this.mapData((stats) => {
				const tieredStats = stats.map((stat) => {
					const card = this.allCards.getCard(stat.cardId);
					const result: DuelsMetaStats = {
						cardId: stat.cardId,
						cardName: card.name,
						globalRunsPlayed: stat.globalTotalMatches,
						globalPopularity: stat.globalPopularity,
						globalWinrate: stat.globalWinrate,
						placementDistribution: stat.globalWinDistribution.map((info) => ({
							wins: info.winNumber,
							percentage: info.value,
							runs: Math.round(info.value * stat.globalTotalMatches),
						})),
						playerRunsPlayed: stat.playerTotalMatches,
						playerWinrate: stat.playerWinrate,
					};
					return result;
				});
				console.debug('tieredStats', tieredStats);
				return tieredStats;
			}),
		);
		this.sort$ = this.listenForBasicPref$((prefs) => prefs.duelsActiveHeroSortFilter);
		this.hideLowData$ = this.listenForBasicPref$((prefs) => prefs.duelsHideStatsBelowThreshold);
	}
}
