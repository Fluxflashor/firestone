import { ComponentType } from '@angular/cdk/portal';
import {
	ChangeDetectionStrategy,
	ChangeDetectorRef,
	Component,
	EventEmitter,
	Input,
	Output,
	ViewRef,
} from '@angular/core';
import { CardIds, defaultStartingHp, GameType } from '@firestone-hs/reference-data';
import { Entity } from '@firestone-hs/replay-parser';
import { BgsBoardInfo } from '@firestone-hs/simulate-bgs-battle/dist/bgs-board-info';
import { CardTooltipPositionType } from '@firestone/shared/common/view';
import { CardsFacadeService } from '@firestone/shared/framework/core';
import { buildEntityFromBoardEntity } from '../../../services/battlegrounds/bgs-utils';
import { BgsCardTooltipComponent } from '../bgs-card-tooltip.component';

@Component({
	selector: 'bgs-battle-side',
	styleUrls: [
		`../../../../css/component/controls/controls.scss`,
		`../../../../css/component/controls/control-close.component.scss`,
		`../../../../css/component/battlegrounds/battles/bgs-battle-side.component.scss`,
	],
	template: `
		<div class="bgs-battle-side" [ngClass]="{ 'full-screen-mode': fullScreenMode }">
			<div class="hero">
				<bgs-hero-portrait-simulator
					class="portrait"
					[heroCardId]="heroCardId"
					[heroPowerCardId]="heroPowerCardId"
					[questRewardCardId]="questRewardCardId"
					[health]="health"
					[maxHealth]="maxHealth"
					[tavernTier]="showTavernTier && tavernTier"
					[tooltipPosition]="tooltipPosition"
					[fullScreenMode]="fullScreenMode"
					(portraitChangeRequested)="onPortraitClick()"
					(heroPowerChangeRequested)="onHeroPowerClick()"
					(questRewardChangeRequested)="onQuestRewardClick()"
				></bgs-hero-portrait-simulator>
			</div>
			<div class="board" cdkDropListGroup (cdkDropListDropped)="drop($event)">
				<!-- See https://stackoverflow.com/questions/65726138/how-can-i-use-angular-material-drag-n-drop-with-flex-layout -->
				<div
					class="minion-container"
					*ngFor="let entity of entities; let i = index; trackBy: trackByFn"
					cdkDropList
					cdkDropListOrientation="horizontal"
					[cdkDropListData]="i"
					(cdkDropListDropped)="drop($event)"
					cachedComponentTooltip
					[componentType]="componentType"
					[componentInput]="entity"
					[componentTooltipPosition]="'right'"
					[componentTooltipForceHide]="forceTooltipHidden"
				>
					<card-on-board
						class="minion"
						[entity]="entity"
						(mousedown)="preventAppDrag($event)"
						cdkDrag
						[cdkDragData]="entity"
						(cdkDropListDropped)="drop($event)"
					>
					</card-on-board>
					<bgs-plus-button
						class="button update"
						[useUpdateIcon]="true"
						(click)="updateMinion(entity, i)"
						*ngIf="closeOnMinion"
						[helpTooltip]="'battlegrounds.sim.update-minion-button-tooltip' | owTranslate"
					></bgs-plus-button>
					<bgs-minus-button
						class="button remove"
						(click)="removeMinion(entity, i)"
						*ngIf="closeOnMinion"
						helpTooltip="Remove minion"
						[helpTooltip]="'battlegrounds.sim.remove-minion-button-tooltip' | owTranslate"
					></bgs-minus-button>
				</div>
				<div class="click-to-add" *ngIf="((entities && entities.length) || 0) < 7 && allowClickToAdd">
					<bgs-plus-button
						class="change-icon"
						(click)="addMinion()"
						[helpTooltip]="'battlegrounds.sim.add-minion-button-tooltip' | owTranslate"
					></bgs-plus-button>
					<div class="empty-minion" inlineSVG="assets/svg/bg_empty_minion.svg"></div>
				</div>
			</div>
			<div class="global-effects">
				<div class="header" [owTranslate]="'battlegrounds.sim.global-effects-header'"></div>
				<fs-numeric-input-with-arrows
					class="input undead-army"
					[label]="undeadArmyLabel"
					[helpTooltip]="'battlegrounds.sim.undead-army-tooltip' | owTranslate"
					[value]="undeadArmy"
					[debounceTime]="200"
					(fsModelUpdate)="onUndeadArmyChanged($event)"
				>
				</fs-numeric-input-with-arrows>
				<fs-numeric-input-with-arrows
					class="input eternal-legion"
					[label]="eternalLegionLabel"
					[helpTooltip]="'battlegrounds.sim.eternal-legion-tooltip' | owTranslate"
					[value]="eternalLegion"
					[minValue]="0"
					[debounceTime]="200"
					(fsModelUpdate)="onEternalLegionChanged($event)"
				>
				</fs-numeric-input-with-arrows>
			</div>
		</div>
	`,
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BgsBattleSideComponent {
	componentType: ComponentType<any> = BgsCardTooltipComponent;

	@Output() addMinionRequested: EventEmitter<ChangeMinionRequest> = new EventEmitter<ChangeMinionRequest>();
	@Output() updateMinionRequested: EventEmitter<ChangeMinionRequest> = new EventEmitter<ChangeMinionRequest>();
	@Output() removeMinionRequested: EventEmitter<ChangeMinionRequest> = new EventEmitter<ChangeMinionRequest>();
	@Output() entitiesUpdated: EventEmitter<readonly Entity[]> = new EventEmitter<readonly Entity[]>();
	@Output() portraitChangeRequested: EventEmitter<void> = new EventEmitter<void>();
	@Output() heroPowerChangeRequested: EventEmitter<void> = new EventEmitter<void>();
	@Output() questRewardChangeRequested: EventEmitter<void> = new EventEmitter<void>();
	@Output() eternalLegionChanged = new EventEmitter<number>();
	@Output() undeadArmyChanged = new EventEmitter<number>();

	@Input() set player(value: BgsBoardInfo) {
		this._player = value;
		this.updateInfo();
	}

	@Input() allowClickToAdd: boolean;
	@Input() clickToChange = false;
	@Input() closeOnMinion = false;
	@Input() showTavernTier = false;
	@Input() fullScreenMode = false;
	@Input() tooltipPosition: CardTooltipPositionType;

	_player: BgsBoardInfo;

	heroCardId: string;
	heroPowerCardId: string;
	questRewardCardId: string;
	health: number;
	maxHealth: number;
	tavernTier: number;
	undeadArmy: number;
	eternalLegion: number;
	forceTooltipHidden = false;

	entities: readonly Entity[];

	undeadArmyLabel = this.allCards.getCard(CardIds.NerubianDeathswarmer_UndeadArmyEnchantment).name;
	eternalLegionLabel = this.allCards.getCard(CardIds.EternalLegionEnchantment).name;

	constructor(private readonly cdr: ChangeDetectorRef, private readonly allCards: CardsFacadeService) {}

	trackByFn(index, item: Entity) {
		return item.id;
	}

	preventAppDrag(event: MouseEvent) {
		event.stopPropagation();
		this.forceTooltipHidden = true;
		if (!(this.cdr as ViewRef)?.destroyed) {
			this.cdr.detectChanges();
		}
	}

	// CdkDragDrop<number>
	drop(event: any) {
		const movedElement: Entity = event.item.data;
		const movedElementNewIndex = event.container.data;
		const entitiesWithoutMovedElement: Entity[] = this.entities.filter((entity) => entity.id !== movedElement.id);
		entitiesWithoutMovedElement.splice(movedElementNewIndex, 0, movedElement);
		this.entities = entitiesWithoutMovedElement;
		this.entitiesUpdated.next(this.entities);
		this.forceTooltipHidden = false;
		if (!(this.cdr as ViewRef)?.destroyed) {
			this.cdr.detectChanges();
		}
	}

	onPortraitClick() {
		this.portraitChangeRequested.next();
	}

	onHeroPowerClick() {
		this.heroPowerChangeRequested.next();
	}

	onQuestRewardClick() {
		this.questRewardChangeRequested.next();
	}

	onUndeadArmyChanged(value: number) {
		this.undeadArmyChanged.next(value);
	}

	onEternalLegionChanged(value: number) {
		this.eternalLegionChanged.next(value);
	}

	addMinion() {
		this.addMinionRequested.next(null);
	}

	updateMinion(entity: Entity, index: number) {
		this.updateMinionRequested.next({
			index: index,
		});
	}

	removeMinion(entity: Entity, index: number) {
		this.removeMinionRequested.next({
			index: index,
		});
	}

	private updateInfo() {
		if (!this._player) {
			return;
		}

		this.heroCardId = this._player.player?.cardId;
		this.heroPowerCardId = this._player.player?.heroPowerId;
		this.questRewardCardId = !!this._player.player?.questRewards?.length
			? this._player.player?.questRewards[0]
			: null;
		this.health = this._player.player.hpLeft;
		this.maxHealth = defaultStartingHp(GameType.GT_BATTLEGROUNDS, this._player.player?.cardId, this.allCards);
		this.tavernTier = this._player.player.tavernTier;
		this.undeadArmy = this._player.player?.globalInfo?.UndeadAttackBonus ?? 0;
		this.eternalLegion = this._player.player?.globalInfo?.EternalKnightsDeadThisGame ?? 0;

		this.entities = (this._player.board ?? []).map((minion) => buildEntityFromBoardEntity(minion, this.allCards));
		if (!(this.cdr as ViewRef)?.destroyed) {
			this.cdr.detectChanges();
		}
	}
}

export interface ChangeMinionRequest {
	// entity: Entity;
	index: number;
}
