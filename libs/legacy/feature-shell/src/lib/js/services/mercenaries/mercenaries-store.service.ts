import { Injectable } from '@angular/core';
import { CardsFacadeService, OverwolfService } from '@firestone/shared/framework/core';
import { BehaviorSubject, combineLatest, Observable } from 'rxjs';
import { concatMap, distinctUntilChanged, filter, map } from 'rxjs/operators';
import { GameEvent } from '../../models/game-event';
import { MainWindowState } from '../../models/mainwindow/main-window-state';
import { NavigationState } from '../../models/mainwindow/navigation/navigation-state';
import { MercenariesBattleState } from '../../models/mercenaries/mercenaries-battle-state';
import { Preferences } from '../../models/preferences';
import { GameEventsEmitterService } from '../game-events-emitter.service';
import { MemoryInspectionService } from '../plugins/memory-inspection.service';
import { MercenariesOverlayHandler } from './overlay-handler/_mercenaries-overlay-handler';
import { MercenariesAbilityActivatedParser } from './parser/mercenaries-ability-activated-parser';
import { MercenariesAbilityQueuedParser } from './parser/mercenaries-ability-queued-parser';
import { MercenariesAbilityRevealedParser } from './parser/mercenaries-ability-revealed-parser';
import { MercenariesAbilityUnqueuedParser } from './parser/mercenaries-ability-unqueued-parser';
import { MercenariesAbilityUpdatedParser } from './parser/mercenaries-ability-updated-parser';
import { MercenariesBuffsParser } from './parser/mercenaries-buffs-parser';
import { MercenariesCooldownUpdatedParser } from './parser/mercenaries-cooldown-updated-parser';
import { MercenariesEquipmentRevealedParser } from './parser/mercenaries-equipment-revealed-parser';
import { MercenariesEquipmentUpdatedParser } from './parser/mercenaries-equipment-updated-parser';
import { MercenariesGameEndParser } from './parser/mercenaries-game-end-parser';
import { MercenariesHeroDiedParser } from './parser/mercenaries-hero-died-parser';
import { MercenariesHeroRevealedParser } from './parser/mercenaries-hero-revealed-parser';
import { MercenariesHeroRevivedParser } from './parser/mercenaries-hero-revived-parser';
import { MercenariesHeroUpdatedParser } from './parser/mercenaries-hero-updated-parser';
import { MercenariesMatchMetadataParser } from './parser/mercenaries-match-metadata-parser';
import { MercenariesSpeedParser } from './parser/mercenaries-speed-parser';
import { MercenariesTeamOpponentManualCloseParser } from './parser/mercenaries-team-opponent-manual-close-parser';
import { MercenariesTeamPlayerManualCloseParser } from './parser/mercenaries-team-player-manual-close-parser';
import { MercenariesTurnStartParser } from './parser/mercenaries-turn-start-parser';
import { MercenariesZoneChangedParser } from './parser/mercenaries-zone-changed-parser';
import { MercenariesZonePositionChangedParser } from './parser/mercenaries-zone-position-changed-parser';
import { MercenariesParser } from './parser/_mercenaries-parser';

@Injectable()
export class MercenariesStoreService {
	public store$ = new BehaviorSubject<MercenariesBattleState>(null);

	private internalStore$ = new BehaviorSubject<MercenariesBattleState>(null);
	private internalEventSubject$ = new BehaviorSubject<GameEvent>(null);

	private preferences$: Observable<Preferences>;
	private mainWindowState$: Observable<[MainWindowState, NavigationState]>;

	private parsers: { [eventType: string]: readonly MercenariesParser[] };
	private eventEmitters: ((state: MercenariesBattleState) => void)[] = [];
	private overlayHandlers: MercenariesOverlayHandler[];

	constructor(
		private readonly events: GameEventsEmitterService,
		private readonly allCards: CardsFacadeService,
		private readonly ow: OverwolfService,
		private readonly memoryService: MemoryInspectionService,
	) {
		window['battleStateUpdater'] = this.internalEventSubject$;
		window['mercenariesStore'] = this.store$;
		this.init();

		// So that we're sure that all services have been initialized
		setTimeout(() => {
			this.preferences$ = (this.ow.getMainWindow().preferencesEventBus as BehaviorSubject<any>)
				.asObservable()
				.pipe(map((theEvent) => theEvent.preferences as Preferences));
			this.mainWindowState$ = (
				this.ow.getMainWindow().mainWindowStoreMerged as BehaviorSubject<[MainWindowState, NavigationState]>
			).asObservable();

			combineLatest(this.internalEventSubject$.asObservable(), this.mainWindowState$)
				.pipe(
					distinctUntilChanged(),
					filter(([event, mainWindowState]) => !!event),
					concatMap(async ([event, mainWindowState]) => await this.processEvent(event, mainWindowState[0])),
				)
				.subscribe();
			combineLatest(this.preferences$, this.internalStore$.asObservable())
				.pipe(
					distinctUntilChanged(),
					concatMap(async ([prefs, newState]) => await this.emitState(newState, prefs)),
				)
				.subscribe();
		});
	}

	// Maybe find a way to only emit the state each N milliseconds at the most to limit the
	// redraws in the UI
	private async processEvent(event: GameEvent, mainWindowState: MainWindowState): Promise<void> {
		try {
			const battleState = this.internalStore$.value;

			// TODO: have a way to delay some parsers, without causing the whole parser chain to get
			// stuck; Hve getParserFor return two lists, one for immediate processing and the other
			// for delay, and reenqueue the delayed one after a setTimeout
			const parsers = this.getParsersFor(event.type, battleState);
			if (!parsers?.length) {
				return;
			}

			let state = battleState;
			for (const parser of parsers) {
				state = await parser.parse(state, event, mainWindowState);
			}
			this.internalStore$.next(state);
		} catch (e) {
			console.error('[mercenaries-store] could not process event', event.type, event, e);
		}
	}

	private async emitState(newState: MercenariesBattleState, preferences: Preferences): Promise<void> {
		this.eventEmitters.forEach((emitter) => emitter(newState));
		await Promise.all(this.overlayHandlers.map((handler) => handler.updateOverlay(newState, preferences)));
	}

	private init() {
		this.events.allEvents.subscribe((event) => this.internalEventSubject$.next(event));
		this.registerParser();
		this.buildEventEmitters();
		this.buildOverlayHandlers();
	}

	private getParsersFor(type: string, battleState: MercenariesBattleState): readonly MercenariesParser[] {
		const candidates = this.parsers[type];
		return candidates?.filter((parser) => parser.applies(battleState));
	}

	private buildEventEmitters() {
		const result = [(state) => this.store$.next(state)];
		this.eventEmitters = result;
	}

	private buildOverlayHandlers() {
		this.overlayHandlers = [];
	}

	private registerParser() {
		const parsers: readonly MercenariesParser[] = [
			new MercenariesMatchMetadataParser(this.memoryService),
			new MercenariesTurnStartParser(),
			new MercenariesGameEndParser(),

			new MercenariesHeroRevealedParser(this.allCards),
			new MercenariesHeroUpdatedParser(this.allCards),
			new MercenariesHeroDiedParser(this.allCards),
			new MercenariesHeroRevivedParser(),
			new MercenariesAbilityRevealedParser(this.allCards),
			new MercenariesAbilityUpdatedParser(this.allCards),
			new MercenariesAbilityActivatedParser(this.allCards),
			new MercenariesEquipmentRevealedParser(this.allCards),
			new MercenariesEquipmentUpdatedParser(this.allCards),
			new MercenariesCooldownUpdatedParser(this.allCards),
			new MercenariesZoneChangedParser(),
			new MercenariesZonePositionChangedParser(),
			new MercenariesBuffsParser(this.allCards),
			new MercenariesSpeedParser(this.allCards),

			new MercenariesTeamPlayerManualCloseParser(),
			new MercenariesTeamOpponentManualCloseParser(),

			new MercenariesAbilityQueuedParser(this.allCards),
			new MercenariesAbilityUnqueuedParser(),
		];
		this.parsers = {};
		for (const parser of parsers) {
			if (!this.parsers[parser.eventType()]) {
				this.parsers[parser.eventType()] = [];
			}
			this.parsers[parser.eventType()] = [...this.parsers[parser.eventType()], parser];
		}
	}
}
