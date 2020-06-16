import { BattlegroundsState } from '../../../../models/battlegrounds/battlegrounds-state';
import { Preferences } from '../../../../models/preferences';
import { OverwolfService } from '../../../overwolf.service';
import { PreferencesService } from '../../../preferences.service';
import { isWindowClosed } from '../../../utils';
import { BattlegroundsStoreEvent } from '../events/_battlegrounds-store-event';
import { BattlegroundsOverlay } from './battlegrounds-overlay';

export class BgsMainWindowOverlay implements BattlegroundsOverlay {
	private closedByUser: boolean;
	private bgsActive = true;

	constructor(private readonly prefs: PreferencesService, private readonly ow: OverwolfService) {}

	public async processEvent(gameEvent: BattlegroundsStoreEvent) {
		if (gameEvent.type === 'BgsMatchStartEvent') {
			this.closedByUser = false;
		} else if (gameEvent.type === 'BgsCloseWindowEvent') {
			this.closedByUser = true;
		}
	}

	public async handleDisplayPreferences(preferences: Preferences) {
		this.bgsActive = preferences.bgsEnableApp;
	}

	public async updateOverlay(state: BattlegroundsState) {
		const prefs = await this.prefs.getPreferences();
		const windowId = prefs.bgsUseOverlay
			? OverwolfService.BATTLEGROUNDS_WINDOW_OVERLAY
			: OverwolfService.BATTLEGROUNDS_WINDOW;
		const battlegroundsWindow = await this.ow.getWindowState(windowId);
		// console.log('use overlay?', prefs.bgsUseOverlay, battlegroundsWindow);
		// console.warn('updazting overlay', battlegroundsWindow);
		// Minimize is only triggered by a user action, so if they minimize it we don't touch it
		if (battlegroundsWindow.window_state_ex === 'minimized' && !state.forceOpen) {
			return;
		}

		const inGame = state && state.inGame;
		// console.warn(battlegroundsWindow);
		if (inGame && this.bgsActive && state.forceOpen) {
			console.log('[bgs-store] showing window', battlegroundsWindow, inGame, this.bgsActive, state.forceOpen);
			if (state.forceOpen) {
				this.closedByUser = false;
			}
			await this.ow.obtainDeclaredWindow(windowId);
			if (battlegroundsWindow.window_state_ex !== 'maximized' && battlegroundsWindow.stateEx !== 'maximized') {
				await this.ow.restoreWindow(windowId);
			} else {
				// console.log('not restoring window', battlegroundsWindow.window_state_ex);
			}
			await this.ow.bringToFront(windowId);
		}
		// In fact we don't want to close the window when the game ends
		else if (
			!isWindowClosed(battlegroundsWindow.window_state_ex) &&
			!isWindowClosed(battlegroundsWindow.stateEx) &&
			this.closedByUser
		) {
			// console.log('[bgs-store] closing window', battlegroundsWindow, inGame, this.bgsActive, state.forceOpen);
			await this.ow.hideWindow(windowId);
		}
	}

	public async handleHotkeyPressed(state: BattlegroundsState) {
		const prefs = await this.prefs.getPreferences();
		const windowId = prefs.bgsUseOverlay
			? OverwolfService.BATTLEGROUNDS_WINDOW_OVERLAY
			: OverwolfService.BATTLEGROUNDS_WINDOW;
		const window = await this.ow.obtainDeclaredWindow(windowId);
		//console.warn('hotkey pressed', window);
		const inGame = state && state.inGame;
		const shouldShowOverlay = true;
		if (!inGame || !shouldShowOverlay) {
			console.log('[bgs-store] not in game or shouldnt show overlay', inGame, shouldShowOverlay);
			return;
		}

		if (isWindowClosed(window.stateEx) || window.stateEx === 'minimized') {
			console.log('[bgs-store] showing BGS window', window);
			this.closedByUser = false;
			await this.ow.obtainDeclaredWindow(windowId);
			await this.ow.restoreWindow(windowId);
			await this.ow.bringToFront(windowId);
		} else if (!isWindowClosed(window.stateEx)) {
			console.log('[bgs-store] hiding BGS window', window);
			this.closedByUser = true;
			await this.ow.hideWindow(windowId);
		}
	}
}
