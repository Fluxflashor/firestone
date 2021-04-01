import { Injectable } from '@angular/core';
import { GameStat } from '../../models/mainwindow/stats/game-stat';
import { GameStats } from '../../models/mainwindow/stats/game-stats';
import { Events } from '../events.service';
import { ShowReplayEvent } from '../mainwindow/store/events/replays/show-replay-event';
import { Message, OwNotificationsService } from '../notifications.service';
import { PreferencesService } from '../preferences.service';
import { RewardMonitorService, XpForGameInfo } from '../rewards/rewards-monitor';

declare let amplitude;

@Injectable()
export class ReplaysNotificationService {
	constructor(
		private readonly notificationService: OwNotificationsService,
		private readonly prefs: PreferencesService,
		private readonly events: Events,
		private readonly rewards: RewardMonitorService,
	) {
		this.events
			.on(Events.GAME_STATS_UPDATED)
			.subscribe(data => this.showNewMatchEndNotification(Object.assign(new GameStats(), data.data[0])));
		console.log('[replays-notification] listening for achievement completion events');
	}

	private async showNewMatchEndNotification(stats: GameStats) {
		const prefs = await this.prefs.getPreferences();
		if (!prefs.showXpRecapAtGameEnd) {
			console.log('[replays-notification] preference is turned off, not showing replay notification');
			return;
		}

		const xpForGame = await this.rewards.getXpForGameInfo();
		if (!xpForGame?.realXpGained) {
			return;
		}

		const stat = Object.assign(new GameStat(), stats.stats[0]);
		console.log('[replays-notification] preparing new game stat notification', stat);
		// console.log('[replays-notification] will emit notif notification', stat);
		this.notificationService.emitNewNotification({
			notificationId: `replay-${stat.reviewId}`,
			content: this.buildNotificationTemplate(stat, xpForGame),
			type: 'match-stats-recorded',
			app: 'replays',
			cardId: undefined,
			theClass: 'active',
			clickToClose: true,
			eventToSendOnClick: () => new ShowReplayEvent(stat.reviewId),
		} as Message);
	}

	private buildNotificationTemplate(stat: GameStat, xpForGame: XpForGameInfo): string {
		const rankImage = stat.buildPlayerRankImage();
		// console.log('[replays-notification] preparing playerRankImage', playerRankImage);
		const rankText = stat.buildRankText() || '';
		const playerRankImage = rankImage.frameImage ? `<img class="art" src="${rankImage.frameImage}" />` : ``;
		const bonusClass = xpForGame?.bonusXp ? 'bonus' : '';
		const xpEl = xpForGame
			? `
			<div class="xp-text">
				<span class="text">You gained</span>
				<div class="value ${bonusClass} has-tooltip">
					<span class="xp-value">${xpForGame.realXpGained}</span>
					<span class="tooltip xp-bonus ${bonusClass}">${xpForGame.bonusXp ? xpForGame.bonusXp : 'No'} XP bonus</span>
				</div>
				<span class="text">XP this match</span>
				<div class="progress">
					<span class="item bracket">(</span>
					<span class="item">${xpForGame.currentXp}</span>
					<span class="item separator">/</span>
					<span class="item">${xpForGame.xpNeeded}</span>
					<span class="item bracket">)</span>
				</div>
			</div>`
			: '';
		return `
			<div class="match-stats-message-container replay-${stat.reviewId}">
				<div class="mode rank-image has-tooltip">
					<div class="rank-icon">
						${playerRankImage}
						<img class="frame" src="${rankImage.frameImage}" />
					</div>
					<div class="rank-text">${rankText}</div>
					<span class="tooltip">Click to watch the replay</span>
				</div>
				<div class="message">
					<div class="title">
						<span>Your match has been recorded</span>
					</div>
					<div class="xp">
						${xpEl}
					</div>
				</div>
				<button class="i-30 close-button">
					<svg class="svg-icon-fill">
						<use xmlns:xlink="https://www.w3.org/1999/xlink" xlink:href="assets/svg/sprite.svg#window-control_close"></use>
					</svg>
				</button>
			</div>`;
	}
}
