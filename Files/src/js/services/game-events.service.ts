import { Injectable, EventEmitter } from '@angular/core';

import { GameEvent } from '../models/game-event';
import { captureEvent } from '@sentry/core';
import { S3FileUploadService } from './s3-file-upload.service';
import { SimpleIOService } from './plugins/simple-io.service';
import { GameEventsPluginService } from './plugins/game-events-plugin.service';
import { OverwolfService } from './overwolf.service';

@Injectable()
export class GameEvents {
	
	public allEvents = new EventEmitter<GameEvent>();
	public newLogLineEvents = new EventEmitter<GameEvent>();
	public onGameStart = new EventEmitter<GameEvent>();

	// The start / end spectating can be set outside of game start / end, so we need to keep it separate
	private spectating: boolean;

	constructor(
		private gameEventsPlugin: GameEventsPluginService,
        private io: SimpleIOService,
        private ow: OverwolfService,
		private s3: S3FileUploadService) {
		this.init();
	}

	private logLines: string[] = [];
	private processingLines = false;

	async init() {
		console.log('init game events monitor');
		const plugin = await this.gameEventsPlugin.get();
		plugin.onGlobalEvent.addListener((first: string, second: string) => {
			console.log('[game-events] received global event', first, second);
			if (first.toLowerCase().indexOf("exception") !== -1 || first.toLowerCase().indexOf("error") !== -1) {
				this.uploadLogsAndSendException(first, second);
			}
		});
		plugin.onGameEvent.addListener((gameEvent) => {
			this.dispatchGameEvent(JSON.parse(gameEvent));
		});
		plugin.initRealtimeLogConversion(() => {
			console.log('[game-events] real-time log processing ready to go');
		});

		setInterval(() => {
			if (this.processingLines) {
				return;
			}
			this.processingLines = true;
			let toProcess: string[] = [];
			let shouldDebug = false;
			if (this.logLines.some((data) => data.indexOf('CREATE_GAME') !== -1)) {
				console.log('[game-events] preparing log lines that include game creation to feed to the plugin', this.logLines);
				shouldDebug = true;
			}
			while (this.logLines.length > 0) {
				toProcess = [...toProcess, ...this.logLines.splice(0, this.logLines.length)];
			}
			if (shouldDebug) {
				console.log('[game-events] build log logs to feed to the plugin', toProcess);
			}
			if (toProcess.length > 0) {
				// console.log('processing start', toProcess);
				plugin.realtimeLogProcessing(toProcess, () => {
					this.processingLines = false;
				});
			}
			else {
				this.processingLines = false;
			}
		},
		500);
	}

	public dispatchGameEvent(gameEvent) {
		console.log(gameEvent.Type + ' event', gameEvent);
		switch (gameEvent.Type) {
			case 'NEW_GAME':
				const event = Object.assign(new GameEvent(), { type: GameEvent.GAME_START, } as GameEvent);
				this.allEvents.next(event);
				this.onGameStart.next(event);
				break;
			case 'MATCH_METADATA':
				this.allEvents.next(Object.assign(new GameEvent(), { 
					type: GameEvent.MATCH_METADATA,
					additionalData: {
						metaData: gameEvent.Value
					} 
				} as GameEvent));
				break;
			case 'LOCAL_PLAYER':
				this.allEvents.next(Object.assign(new GameEvent(), { 
					type: GameEvent.LOCAL_PLAYER,
					localPlayer: gameEvent.Value
				} as GameEvent));
				break;
			case 'OPPONENT_PLAYER':
				this.allEvents.next(Object.assign(new GameEvent(), { 
					type: GameEvent.OPPONENT,
					opponentPlayer: gameEvent.Value
				} as GameEvent));
				break;
			case 'MULLIGAN_INPUT':
				this.allEvents.next(Object.assign(new GameEvent(), { 
					type: GameEvent.MULLIGAN_INPUT,
				} as GameEvent));
				break;
			case 'MULLIGAN_DONE':
				this.allEvents.next(Object.assign(new GameEvent(), { 
					type: GameEvent.MULLIGAN_DONE,
				} as GameEvent));
				break;
			case 'RUMBLE_RUN_STEP':
				this.allEvents.next(Object.assign(new GameEvent(), { 
					type: GameEvent.RUMBLE_RUN_STEP,
					additionalData: {
						step: gameEvent.Value - 1
					}
				} as GameEvent));
				break;
			case 'DUNGEON_RUN_STEP':
				this.allEvents.next(Object.assign(new GameEvent(), { 
					type: GameEvent.DUNGEON_RUN_STEP,
					additionalData: {
						step: gameEvent.Value - 1
					}
				} as GameEvent));
				break;
			case 'MONSTER_HUNT_STEP':
				this.allEvents.next(Object.assign(new GameEvent(), { 
					type: GameEvent.MONSTER_HUNT_STEP,
					additionalData: {
						step: gameEvent.Value - 1
					}
				} as GameEvent));
				break;
			case 'CARD_PLAYED':
				this.allEvents.next(GameEvent.build(GameEvent.CARD_PLAYED, gameEvent));
				break;
			case 'DISCARD_CARD':
				this.allEvents.next(GameEvent.build(GameEvent.DISCARD_CARD, gameEvent));
				break;
			case 'MINION_DIED':
				this.allEvents.next(GameEvent.build(GameEvent.MINION_DIED, gameEvent));
				break;
            case 'RECRUIT_CARD':
				this.allEvents.next(GameEvent.build(GameEvent.RECRUIT_CARD, gameEvent));
                break;
            case 'SECRET_PLAYED_FROM_DECK':
				this.allEvents.next(GameEvent.build(GameEvent.SECRET_PLAYED_FROM_DECK, gameEvent));
                break;
			case 'MINION_SUMMONED':
				this.allEvents.next(GameEvent.build(GameEvent.MINION_SUMMONED, gameEvent));
				break;
			case 'CARD_CHANGED_ON_BOARD':
				this.allEvents.next(GameEvent.build(GameEvent.CARD_CHANGED_ON_BOARD, gameEvent));
				break;
			case 'RECEIVE_CARD_IN_HAND':
				this.allEvents.next(GameEvent.build(GameEvent.RECEIVE_CARD_IN_HAND, gameEvent));
				break;
			case 'END_OF_ECHO_IN_HAND':
				this.allEvents.next(GameEvent.build(GameEvent.END_OF_ECHO_IN_HAND, gameEvent));
				break;
			case 'CREATE_CARD_IN_DECK':
				this.allEvents.next(GameEvent.build(
					GameEvent.CREATE_CARD_IN_DECK, 
					gameEvent,
					{
						creatorCardId: gameEvent.Value.AdditionalProps && gameEvent.Value.AdditionalProps.CreatorCardId
					}));
				break;
			case 'SECRET_PLAYED':
				this.allEvents.next(GameEvent.build(GameEvent.SECRET_PLAYED, gameEvent));
				break;
			case 'CARD_DRAW_FROM_DECK':
				this.allEvents.next(GameEvent.build(GameEvent.CARD_DRAW_FROM_DECK, gameEvent));
				break;
			case 'CARD_BACK_TO_DECK':
				this.allEvents.next(GameEvent.build(
					GameEvent.CARD_BACK_TO_DECK, 
					gameEvent,
					{
						initialZone: gameEvent.Value.AdditionalProps.InitialZone
					}));
				break;
			case 'CARD_REMOVED_FROM_DECK':
				this.allEvents.next(GameEvent.build(GameEvent.CARD_REMOVED_FROM_DECK, gameEvent));
				break;
			case 'CARD_REMOVED_FROM_HAND':
				this.allEvents.next(GameEvent.build(GameEvent.CARD_REMOVED_FROM_HAND, gameEvent));
				break;
			case 'BURNED_CARD':
				this.allEvents.next(GameEvent.build(GameEvent.BURNED_CARD, gameEvent));
				break;
			case 'MULLIGAN_INITIAL_OPTION':
				this.allEvents.next(GameEvent.build(GameEvent.MULLIGAN_INITIAL_OPTION, gameEvent));
				break;
			case 'CARD_ON_BOARD_AT_GAME_START':
				this.allEvents.next(GameEvent.build(GameEvent.CARD_ON_BOARD_AT_GAME_START, gameEvent));
				break;
			case 'PASSIVE_BUFF':
				this.allEvents.next(GameEvent.build(GameEvent.PASSIVE_BUFF, gameEvent));
				break;
            case 'MINION_ON_BOARD_ATTACK_UPDATED':
				this.allEvents.next(GameEvent.build(
					GameEvent.MINION_ON_BOARD_ATTACK_UPDATED, 
					gameEvent,
					{
						initialAttack: gameEvent.Value.InitialAttack,
						newAttack: gameEvent.Value.NewAttack
					}));
                break;
			case 'FATIGUE_DAMAGE':
				this.allEvents.next(Object.assign(new GameEvent(), {
					type: GameEvent.FATIGUE_DAMAGE,
					localPlayer: gameEvent.Value.LocalPlayer,
					opponentPlayer: gameEvent.Value.OpponentPlayer,
					additionalData: {
						playerId: gameEvent.Value.PlayerId,
						fatigueDamage: gameEvent.Value.FatigueDamage
					}
				} as GameEvent));
				break;
			case 'DAMAGE':
				this.allEvents.next(Object.assign(new GameEvent(), {
					type: GameEvent.DAMAGE, 
					localPlayer: gameEvent.Value.LocalPlayer,
					opponentPlayer: gameEvent.Value.OpponentPlayer,
					additionalData: {
						sourceCardId: gameEvent.Value.SourceCardId,
						sourceControllerId: gameEvent.Value.SourceControllerId,
						targets: gameEvent.Value.Targets
					}
				} as GameEvent));
				break;
			case 'TURN_START':
				this.allEvents.next(Object.assign(new GameEvent(), {
					type: GameEvent.TURN_START, 
					additionalData: {
						turnNumber: gameEvent.Value
					}
				} as GameEvent));
				break;
			case 'WINNER':
				this.allEvents.next(Object.assign(new GameEvent(), {
					type: GameEvent.WINNER,
					localPlayer: gameEvent.Value.LocalPlayer,
					opponentPlayer: gameEvent.Value.OpponentPlayer,
					additionalData: {
						winner: gameEvent.Value.Winner,
						report: gameEvent.Value.GameStateReport
					}
				} as GameEvent));
				break;
			case 'GAME_END':
					this.allEvents.next(Object.assign(new GameEvent(), {
						type: GameEvent.GAME_END, 
						additionalData: {
							game: gameEvent.Value.Game,
							replayXWml: gameEvent.Value.ReplayXml
						}
					} as GameEvent));
				break;
			default:
				console.log('unsupported game event', gameEvent);
		}
	}

	public receiveLogLine(data: string) {
		if (data.indexOf('Begin Spectating') !== -1) {
			console.log('begin spectating', data);
			this.spectating = true;
		}
		if (data.indexOf('End Spectator Mode') !== -1) {
			console.log('end spectating', data);
			this.spectating = false;
		}

		if (this.spectating) {
			// For now we're not interested in spectating events, but that will come out later
			return;
		}

		this.logLines.push(data);

		if (data.indexOf('CREATE_GAME') !== -1) {
			console.log('[game-events] received CREATE_GAME log', data, this.logLines);
		}
	}

	private async uploadLogsAndSendException(first, second) {
		try {
            // Get the HS Power.log file
            const res = await this.ow.getRunningGameInfo();
            const logsLocation = res.executionPath.split('Hearthstone.exe')[0] + 'Logs\\Power.log';
            const logLines = await this.io.getFileContents(logsLocation);
            const s3LogFileKey = await this.s3.postLogs(logLines);
            console.log('uploaded logs to S3', s3LogFileKey, 'from location', logsLocation);
            const fullLogsFromPlugin = second.indexOf('/#/') !== -1 ? second.split('/#/')[0] : second;
            const pluginLogsFileKey = await this.s3.postLogs(fullLogsFromPlugin);
            console.log('uploaded fullLogsFromPlugin to S3', pluginLogsFileKey);
            const lastLogsReceivedInPlugin = second.indexOf('/#/') !== -1 ? second.split('/#/')[1] : second;
            const firestoneLogs = await this.io.zipAppLogFolder('Firestone');
            const firstoneLogsKey = await this.s3.postBinaryFile(firestoneLogs);
            console.log('posted Firestone logs', firstoneLogsKey);
            captureEvent({
                message: 'Exception while running plugin: ' + first,
                extra: {
                    first: first,
                    firstProcessedLine: fullLogsFromPlugin.indexOf('\n') !== -1 ? fullLogsFromPlugin.split('\n')[0] : fullLogsFromPlugin,
                    lastLogsReceivedInPlugin: lastLogsReceivedInPlugin,
                    logFileKey: s3LogFileKey,
                    pluginLogsFileKey: pluginLogsFileKey,
                    firestoneLogs: firstoneLogsKey,
                    typeScriptLogLines: this.logLines,
                }
            });
            console.log('uploaded event to sentry');
		}
		catch (e) {
			console.error('Exception while uploading logs for troubleshooting', e);
		}
	}
}
