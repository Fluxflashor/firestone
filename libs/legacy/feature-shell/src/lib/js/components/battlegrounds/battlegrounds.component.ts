import {
	AfterContentInit,
	AfterViewInit,
	ChangeDetectionStrategy,
	ChangeDetectorRef,
	Component,
	EventEmitter,
	HostListener,
	ViewEncapsulation,
} from '@angular/core';
import { OverwolfService } from '@firestone/shared/framework/core';
import { Observable, startWith } from 'rxjs';
import { DebugService } from '../../services/debug.service';
import { PreferencesService } from '../../services/preferences.service';
import { AppUiStoreFacadeService } from '../../services/ui-store/app-ui-store-facade.service';
import { AbstractSubscriptionStoreComponent } from '../abstract-subscription-store.component';

@Component({
	selector: 'battlegrounds',
	styleUrls: [
		`../../../css/global/ngx-tooltips.scss`,
		`../../../css/component/battlegrounds/battlegrounds.component.scss`,
	],
	encapsulation: ViewEncapsulation.None,
	template: `
		<window-wrapper [activeTheme]="'battlegrounds'" [allowResize]="true" [avoidGameOverlap]="true">
			<ads *ngIf="showAds$ | async"></ads>
			<battlegrounds-content> </battlegrounds-content>
		</window-wrapper>
	`,
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BattlegroundsComponent
	extends AbstractSubscriptionStoreComponent
	implements AfterContentInit, AfterViewInit
{
	showAds$: Observable<boolean>;

	windowId: string;

	private hotkeyPressedHandler: EventEmitter<boolean>;
	private hotkey;

	constructor(
		private readonly debug: DebugService,
		private readonly prefs: PreferencesService,
		private readonly ow: OverwolfService,
		protected readonly store: AppUiStoreFacadeService,
		protected readonly cdr: ChangeDetectorRef,
	) {
		super(store, cdr);
		this.init();
	}

	ngAfterContentInit() {
		this.showAds$ = this.store.showAds$().pipe(
			this.mapData((showAds) => showAds),
			startWith(true),
		);
	}

	private async init() {
		this.ow.getTwitterUserInfo();
		this.ow.getRedditUserInfo();
	}

	async ngAfterViewInit() {
		// this.cdr.detach();
		this.windowId = (await this.ow.getCurrentWindow()).id;
		this.hotkeyPressedHandler = this.ow.getMainWindow().bgsHotkeyPressed;
		this.hotkey = await this.ow.getHotKey('battlegrounds');
		this.positionWindowOnSecondScreen();
	}

	@HostListener('window:keydown', ['$event'])
	async onKeyDown(e: KeyboardEvent) {
		const currentWindow = await this.ow.getCurrentWindow();

		if (currentWindow.id.includes('Overlay')) {
			return;
		}
		if (!this.hotkey || this.hotkey.IsUnassigned) {
			return;
		}
		const isAltKey = [1, 3, 5, 7].indexOf(this.hotkey.modifierKeys) !== -1;
		const isCtrlKey = [2, 3, 6, 7].indexOf(this.hotkey.modifierKeys) !== -1;
		const isShiftKey = [4, 5, 6, 7].indexOf(this.hotkey.modifierKeys) !== -1;

		if (
			e.shiftKey === isShiftKey &&
			e.altKey === isAltKey &&
			e.ctrlKey === isCtrlKey &&
			e.keyCode == this.hotkey.virtualKeycode
		) {
			this.hotkeyPressedHandler.next(true);
		}
	}

	@HostListener('mousedown', ['$event'])
	dragMove(event: MouseEvent) {
		const path: any[] = event.composedPath();
		// Hack for drop-downs
		if (
			path.length > 2 &&
			path[0].localName === 'div' &&
			path[0].className?.includes('options') &&
			path[1].localName === 'div' &&
			path[1].className?.includes('below')
		) {
			return;
		}
		this.ow.dragMove(this.windowId);
	}

	private async positionWindowOnSecondScreen() {
		const [monitorsList, gameInfo, prefs] = await Promise.all([
			this.ow.getMonitorsList(),
			this.ow.getRunningGameInfo(),
			this.prefs.getPreferences(),
		]);
		if (monitorsList.displays.length === 1 || prefs.bgsUseOverlay) {
			return;
		}

		const mainMonitor = gameInfo?.monitorHandle?.value ?? -1;
		if (mainMonitor !== -1) {
			const secondMonitor = monitorsList.displays.filter((monitor) => monitor.handle.value !== mainMonitor)[0];
			this.ow.changeWindowPosition(this.windowId, secondMonitor.x + 100, secondMonitor.y + 100);
		}
	}
}
