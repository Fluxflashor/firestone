import { RawAchievement } from '../../../src/js/models/achievement/raw-achievement';
import { AchievementsMonitor } from '../../../src/js/services/achievement/achievements-monitor.service';
import { ChallengeBuilderService } from '../../../src/js/services/achievement/achievements/challenges/challenge-builder.service';
import { AchievementsLoaderService } from '../../../src/js/services/achievement/data/achievements-loader.service';
import { Events } from '../../../src/js/services/events.service';
import { GameEvents } from '../../../src/js/services/game-events.service';
import { AchievementCompletedEvent } from '../../../src/js/services/mainwindow/store/events/achievements/achievement-completed-event';
import { MainWindowStoreService } from '../../../src/js/services/mainwindow/store/main-window-store.service';
import { PlayersInfoService } from '../../../src/js/services/players-info.service';
import { GameEventsPluginService } from '../../../src/js/services/plugins/game-events-plugin.service';
import { MemoryInspectionService } from '../../../src/js/services/plugins/memory-inspection.service';

export const achievementsValidation = async (
	rawAchievements: RawAchievement[],
	pluginEvents,
	additionalEvents?: readonly { key: string; value: any }[],
) => {
	const challengeBuilder = new ChallengeBuilderService();
	const loader = new AchievementsLoaderService(challengeBuilder);
	await loader.initializeAchievements(rawAchievements);
	if (loader.challengeModules.length !== 1) {
		throw new Error('Can only handle single achievements for now');
	}
	// Setup events
	const events = new Events();
	const mockPlugin: GameEventsPluginService = {
		get: () => {
			return new Promise<any>(() => {});
		},
	} as GameEventsPluginService;
	const memoryService: MemoryInspectionService = {
		getPlayerInfo: () => {
			return new Promise<any>(() => {});
		},
	} as MemoryInspectionService;
	const playersInfoService = new PlayersInfoService(events, memoryService);
	const gameEventsService = new GameEvents(mockPlugin, null, null, events, playersInfoService);
	// Setup achievement monitor, that will check for completion
	let isAchievementComplete = false;
	const store: MainWindowStoreService = {
		stateUpdater: {
			next: data => {
				if (data instanceof AchievementCompletedEvent) {
					// console.debug('achievmement complete');
					isAchievementComplete = true;
				}
			},
		} as any,
	} as MainWindowStoreService;
	new AchievementsMonitor(gameEventsService, loader, store);

	if (additionalEvents) {
		additionalEvents.forEach(event => events.broadcast(event.key, event.value));
	}

	// wait for a short while, so that all events are processed. The integration tests
	// take a long time to load (probably because of the big files?), so this small
	// delay has almost no impact
	await sleep(50);

	pluginEvents.forEach(gameEvent => gameEventsService.dispatchGameEvent(gameEvent));

	await sleep(50);

	// if (!isAchievementComplete) {
	// 	loader.challengeModules.forEach((challenge: GenericChallenge) => {
	// 		challenge.requirements.forEach(req => {
	// 			if (!req.isCompleted()) {
	// 				console.debug('req not completed', req, req.isCompleted());
	// 			}
	// 		});
	// 	});
	// }

	return isAchievementComplete;
};

function sleep(ms) {
	return new Promise(resolve => setTimeout(resolve, ms));
}
