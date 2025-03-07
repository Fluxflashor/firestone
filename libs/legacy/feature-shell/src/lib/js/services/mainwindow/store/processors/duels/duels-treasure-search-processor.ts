import { MainWindowState } from '../../../../../models/mainwindow/main-window-state';
import { NavigationDuels } from '../../../../../models/mainwindow/navigation/navigation-duels';
import { NavigationState } from '../../../../../models/mainwindow/navigation/navigation-state';
import { DuelsTreasureSearchEvent } from '../../events/duels/duels-treasure-search-event';
import { Processor } from '../processor';

declare let amplitude;

export class DuelsTreasureSearchProcessor implements Processor {
	public async process(
		event: DuelsTreasureSearchEvent,
		currentState: MainWindowState,
		history,
		navigationState: NavigationState,
	): Promise<[MainWindowState, NavigationState]> {
		if (event.value?.length) {
			amplitude.getInstance().logEvent('search', {
				page: 'duels-treasure',
			});
		}
		return [
			null,
			navigationState.update({
				navigationDuels: navigationState.navigationDuels.update({
					treasureSearchString: event.value,
				} as NavigationDuels),
			} as NavigationState),
		];
	}
}
