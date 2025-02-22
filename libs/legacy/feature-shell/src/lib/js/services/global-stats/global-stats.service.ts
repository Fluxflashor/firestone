import { Injectable } from '@angular/core';
import { GlobalStats } from '@firestone-hs/build-global-stats/dist/model/global-stats';
import { ApiRunner, LocalStorageService, OverwolfService } from '@firestone/shared/framework/core';
import { BehaviorSubject, combineLatest } from 'rxjs';
import { filter } from 'rxjs/operators';
import { GlobalStatsLoadedEvent } from '../mainwindow/store/events/stats/global/global-stats-loaded-event';
import { AppUiStoreFacadeService } from '../ui-store/app-ui-store-facade.service';

const GLOBAL_STATS_ENDPOINT = 'https://dozgz6y7pf.execute-api.us-west-2.amazonaws.com/Prod/globalStats';

@Injectable()
export class GlobalStatsService {
	private requestedInitialGlobalStatsLoad = new BehaviorSubject<boolean>(false);

	constructor(
		private readonly api: ApiRunner,
		private readonly ow: OverwolfService,
		private readonly store: AppUiStoreFacadeService,
		private readonly localStorage: LocalStorageService,
	) {
		this.init();
	}

	private async init() {
		await this.store.initComplete();
		combineLatest(this.requestedInitialGlobalStatsLoad.asObservable())
			.pipe(filter(([load]) => load))
			.subscribe(() => this.loadGlobalStats());
	}

	public loadInitialGlobalStats() {
		this.requestedInitialGlobalStatsLoad.next(true);
	}

	public updateGlobalStats(stats: GlobalStats) {
		this.localStorage.setItem(LocalStorageService.USER_GLOBAL_STATS, stats);
	}

	public async loadGlobalStats() {
		const localInfo = this.localStorage.getItem<GlobalStats>(LocalStorageService.USER_GLOBAL_STATS);
		if (!!localInfo?.stats?.length) {
			console.log('loaded local global stats');
			this.store.send(new GlobalStatsLoadedEvent(localInfo));
		}

		const currentUser = await this.ow.getCurrentUser();
		const remoteData = await this.api.callPostApi<{ result: GlobalStats }>(GLOBAL_STATS_ENDPOINT, {
			userName: currentUser.username,
			userId: currentUser.userId,
			machineId: currentUser.machineId,
		});
		this.localStorage.setItem(LocalStorageService.USER_GLOBAL_STATS, remoteData?.result);
		console.log('loaded remote globalStats');
		this.store.send(new GlobalStatsLoadedEvent(remoteData?.result));
		return remoteData;
	}
}
