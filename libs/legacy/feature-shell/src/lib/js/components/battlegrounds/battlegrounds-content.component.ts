import {
	AfterContentInit,
	AfterViewInit,
	ChangeDetectionStrategy,
	ChangeDetectorRef,
	Component,
	HostListener,
	OnDestroy,
} from '@angular/core';
import { CardsFacadeService, OverwolfService } from '@firestone/shared/framework/core';
import { combineLatest, Observable } from 'rxjs';
import { debounceTime, filter, startWith } from 'rxjs/operators';
import { BgsFaceOffWithSimulation } from '../../models/battlegrounds/bgs-face-off-with-simulation';
import { BgsPanel } from '../../models/battlegrounds/bgs-panel';
import { AppUiStoreFacadeService } from '../../services/ui-store/app-ui-store-facade.service';
import { deepEqual } from '../../services/utils';
import { AbstractSubscriptionStoreComponent } from '../abstract-subscription-store.component';

@Component({
	selector: 'battlegrounds-content',
	styleUrls: [`../../../css/component/battlegrounds/battlegrounds-content.component.scss`],
	template: `
		<div class="battlegrounds">
			<section
				class="content-container"
				*ngIf="{ currentPanelId: currentPanelId$ | async, currentPanel: currentPanel$ | async } as value"
			>
				<div class="title" *ngIf="showTitle$ | async">{{ value.currentPanel?.name }}</div>
				<ng-container>
					<bgs-hero-selection-overview *ngIf="value.currentPanelId === 'bgs-hero-selection-overview'">
					</bgs-hero-selection-overview>
					<bgs-next-opponent-overview *ngIf="value.currentPanelId === 'bgs-next-opponent-overview'">
					</bgs-next-opponent-overview>
					<bgs-post-match-stats
						*ngIf="value.currentPanelId === 'bgs-post-match-stats'"
						[panel]="value.currentPanel"
						[reviewId]="reviewId$ | async"
						[faceOffs]="faceOffs$ | async"
						[mmr]="mmr$ | async"
						[gameEnded]="gameEnded$ | async"
						[mainPlayerCardId]="mainPlayerCardId$ | async"
					>
					</bgs-post-match-stats>
					<bgs-battles *ngIf="value.currentPanelId === 'bgs-battles'"> </bgs-battles>
				</ng-container>
			</section>
		</div>
		<ads *ngIf="showAds$ | async" [showTopAd]="true"></ads>
	`,
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BattlegroundsContentComponent
	extends AbstractSubscriptionStoreComponent
	implements AfterContentInit, AfterViewInit, OnDestroy
{
	showTitle$: Observable<boolean>;
	currentPanelId$: Observable<string>;
	currentPanel$: Observable<BgsPanel | any>;
	reviewId$: Observable<string>;
	mainPlayerCardId$: Observable<string>;
	mmr$: Observable<number>;
	gameEnded$: Observable<boolean>;
	faceOffs$: Observable<readonly BgsFaceOffWithSimulation[]>;
	showAds$: Observable<boolean>;

	windowId: string;

	constructor(
		protected readonly store: AppUiStoreFacadeService,
		protected readonly cdr: ChangeDetectorRef,
		private readonly ow: OverwolfService,
		private readonly allCards: CardsFacadeService,
	) {
		super(store, cdr);
	}

	ngAfterContentInit() {
		this.currentPanelId$ = this.store
			.listenBattlegrounds$(([state]) => state.currentPanelId)
			.pipe(
				filter(([currentPanelId]) => !!currentPanelId),
				this.mapData(([currentPanelId]) => currentPanelId),
			);
		this.currentPanel$ = this.store
			.listenBattlegrounds$(
				([state]) => state.panels,
				([state]) => state.currentPanelId,
			)
			.pipe(
				debounceTime(200),
				filter(([panels, currentPanelId]) => !!panels?.length && !!currentPanelId),
				this.mapData(([panels, currentPanelId]) => panels.find((panel) => panel.id === currentPanelId)),
			);
		this.showTitle$ = combineLatest(
			this.listenForBasicPref$((prefs) => prefs.bgsShowNextOpponentRecapSeparately),
			this.currentPanelId$,
		).pipe(
			this.mapData(
				([showNextOpponentRecapSeparately, currentPanelId]) =>
					showNextOpponentRecapSeparately || currentPanelId !== 'bgs-next-opponent-overview',
			),
		);
		this.reviewId$ = this.store
			.listenBattlegrounds$(([state]) => state.currentGame?.reviewId)
			.pipe(this.mapData(([reviewId]) => reviewId));
		this.mainPlayerCardId$ = this.store
			.listenBattlegrounds$(([state]) => state.currentGame)
			.pipe(
				this.mapData(([currentGame]) => currentGame?.getMainPlayer()?.getNormalizedHeroCardId(this.allCards)),
			);
		this.mmr$ = this.store
			.listenBattlegrounds$(([state]) => state.currentGame?.mmrAtStart)
			.pipe(this.mapData(([mmrAtStart]) => mmrAtStart));
		this.gameEnded$ = this.store
			.listenBattlegrounds$(([state]) => state.currentGame?.gameEnded)
			.pipe(this.mapData(([gameEnded]) => gameEnded));
		this.faceOffs$ = this.store
			.listenBattlegrounds$(([state]) => state.currentGame?.faceOffs)
			.pipe(
				debounceTime(1000),
				filter(([faceOffs]) => !!faceOffs?.length),
				this.mapData(
					([faceOffs]) => faceOffs,
					(a, b) => deepEqual(a, b),
					0,
				),
			);
		this.showAds$ = this.store.showAds$().pipe(
			this.mapData((showAds) => showAds),
			startWith(true),
		);
	}

	async ngAfterViewInit() {
		this.windowId = (await this.ow.getCurrentWindow()).id;
	}

	@HostListener('window:beforeunload')
	ngOnDestroy() {
		super.ngOnDestroy();
	}
}
