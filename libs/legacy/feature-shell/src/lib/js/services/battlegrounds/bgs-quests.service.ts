/* eslint-disable @typescript-eslint/no-use-before-define */
import { Injectable } from '@angular/core';
import { BgsGlobalHeroStat2, BgsGlobalStats2 } from '@firestone-hs/bgs-global-stats';
import { BgsActiveTimeFilterType } from '@firestone/battlegrounds/data-access';
import { ApiRunner, LocalStorageService } from '@firestone/shared/framework/core';
import { BehaviorSubject, combineLatest } from 'rxjs';
import { filter } from 'rxjs/operators';
import { BgsQuestsDataLoadedEvent } from '../mainwindow/store/events/battlegrounds/bgs-quests-data-loaded-event';
import { AppUiStoreFacadeService } from '../ui-store/app-ui-store-facade.service';
import { fixInvalidTimeSuffix } from './bgs-global-stats.service';

const BGS_STATS_RETRIEVE_URL = 'https://static.zerotoheroes.com/api/bgs/quests/bgs-global-stats-%timeSuffix%.gz.json';

@Injectable()
export class BattlegroundsQuestsService {
	private requestedInitialRefDataLoad = new BehaviorSubject<boolean>(false);

	constructor(
		private readonly api: ApiRunner,
		private readonly store: AppUiStoreFacadeService,
		private readonly localStorage: LocalStorageService,
	) {
		this.init();
	}

	private async init() {
		await this.store.initComplete();
		combineLatest(
			this.store.listenPrefs$((prefs) => prefs.bgsActiveTimeFilter),
			this.requestedInitialRefDataLoad.asObservable(),
		)
			.pipe(filter(([[timeFilter], load]) => load))
			.subscribe(([[timeFilter], load]) => this.loadReferenceData(timeFilter));
	}

	public loadInitialReferenceData() {
		this.requestedInitialRefDataLoad.next(true);
	}

	public async loadReferenceData(timeFilter: BgsActiveTimeFilterType) {
		const localInfo = this.localStorage.getItem<readonly BgsGlobalHeroStat2[]>(LocalStorageService.BGS_QUESTS_DATA);
		if (!!localInfo?.length) {
			console.log('loaded local bgs quests data');
			this.store.send(new BgsQuestsDataLoadedEvent(localInfo));
		}

		const result = await this.api.callGetApi<BgsGlobalStats2>(
			`${BGS_STATS_RETRIEVE_URL.replace('%timeSuffix%', fixInvalidTimeSuffix(timeFilter))}`,
		);
		const referenceData = result?.heroStats;
		this.localStorage.setItem(LocalStorageService.BGS_QUESTS_DATA, referenceData);
		console.log('loaded bgs-quests-data ref data');
		this.store.send(new BgsQuestsDataLoadedEvent(referenceData));
		return referenceData;
	}
}
