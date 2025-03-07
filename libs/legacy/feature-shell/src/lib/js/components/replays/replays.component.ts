import { AfterContentInit, ChangeDetectionStrategy, ChangeDetectorRef, Component } from '@angular/core';
import { Observable } from 'rxjs';
import { BgsPostMatchStatsPanel } from '../../models/battlegrounds/post-match/bgs-post-match-stats-panel';
import { CurrentViewType } from '../../models/mainwindow/replays/current-view.type';
import { AppUiStoreFacadeService } from '../../services/ui-store/app-ui-store-facade.service';
import { AbstractSubscriptionStoreComponent } from '../abstract-subscription-store.component';

@Component({
	selector: 'replays',
	styleUrls: [
		`../../../css/component/app-section.component.scss`,
		`../../../css/component/replays/replays.component.scss`,
	],
	template: `
		<div class="app-section replays" *ngIf="currentView$ | async as currentView">
			<section class="main divider">
				<with-loading [isLoading]="loading$ | async">
					<div class="content main-content">
						<global-header *ngIf="showGlobalHeader$ | async"> </global-header>
						<replays-list *ngIf="currentView === 'list'"></replays-list>
						<match-details *ngIf="currentView === 'match-details'"></match-details>
					</div>
				</with-loading>
			</section>

			<ng-container
				*ngIf="{
					bgsPostMatchStatsPanel: bgsPostMatchStatsPanel$ | async,
					isShowingDuels: isShowingDuels$ | async
				} as value"
			>
				<section
					class="secondary"
					*ngIf="
						!(showAds$ | async) &&
						showSidebar(currentView, value.isShowingDuels, value.bgsPostMatchStatsPanel?.player?.cardId)
					"
				>
					<div class="match-stats" *ngIf="value.bgsPostMatchStatsPanel?.player?.cardId">
						<div class="title" [owTranslate]="'app.replays.bg-stats.title'"></div>
						<bgs-post-match-stats-recap [stats]="value.bgsPostMatchStatsPanel"></bgs-post-match-stats-recap>
					</div>
					<div class="replays-list" *ngIf="value.isShowingDuels && currentView === 'match-details'">
						<duels-replays-recap-for-run></duels-replays-recap-for-run>
					</div>
				</section>
			</ng-container>
		</div>
	`,
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReplaysComponent extends AbstractSubscriptionStoreComponent implements AfterContentInit {
	loading$: Observable<boolean>;
	showGlobalHeader$: Observable<boolean>;
	currentView$: Observable<CurrentViewType>;
	bgsPostMatchStatsPanel$: Observable<BgsPostMatchStatsPanel>;
	isShowingDuels$: Observable<boolean>;
	showAds$: Observable<boolean>;

	constructor(protected readonly store: AppUiStoreFacadeService, protected readonly cdr: ChangeDetectorRef) {
		super(store, cdr);
	}

	ngAfterContentInit() {
		this.loading$ = this.store
			.listen$(([main, nav, prefs]) => main.replays.isLoading)
			.pipe(this.mapData(([isLoading]) => isLoading));
		this.showGlobalHeader$ = this.store
			.listen$(([main, nav, prefs]) => nav.text)
			.pipe(this.mapData(([text]) => !!text));
		this.currentView$ = this.store
			.listen$(([main, nav, prefs]) => nav.navigationReplays.currentView)
			.pipe(this.mapData(([currentView]) => currentView));
		this.bgsPostMatchStatsPanel$ = this.store
			.listen$(([main, nav, prefs]) => nav.navigationReplays.selectedReplay?.bgsPostMatchStatsPanel)
			.pipe(this.mapData(([bgsPostMatchStatsPanel]) => bgsPostMatchStatsPanel));
		this.isShowingDuels$ = this.store
			.listen$(([main, nav, prefs]) => nav.navigationReplays.selectedReplay?.replayInfo)
			.pipe(this.mapData(([replayInfo]) => replayInfo?.isDuels()));
		this.showAds$ = this.store.showAds$().pipe(this.mapData((info) => info));
	}

	showSidebar(currentView: CurrentViewType, isShowingDuels: boolean, bgsPlayerCardId: string): boolean {
		return !(currentView === 'list' || (currentView === 'match-details' && !isShowingDuels && !bgsPlayerCardId));
	}
}
