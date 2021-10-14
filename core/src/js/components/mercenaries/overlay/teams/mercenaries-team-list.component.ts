import { ChangeDetectionStrategy, ChangeDetectorRef, Component, Input, ViewRef } from '@angular/core';
import { BattleMercenary, MercenariesBattleTeam } from '../../../../models/mercenaries/mercenaries-battle-state';

@Component({
	selector: 'mercenaries-team-list',
	styleUrls: [
		'../../../../../css/global/components-global.scss',
		`../../../../../css/global/scrollbar-decktracker-overlay.scss`,
		'../../../../../css/component/decktracker/overlay/dim-overlay.scss',
		'../../../../../css/component/mercenaries/overlay/teams/mercenaries-team-list.component.scss',
	],
	template: `
		<perfect-scrollbar class="team-list">
			<div class="list-background"></div>
			<mercenaries-team-mercenary
				*ngFor="let mercenary of mercenaries"
				[mercenary]="mercenary"
				[tooltipPosition]="tooltipPosition"
			></mercenaries-team-mercenary>
		</perfect-scrollbar>
	`,
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MercenariesTeamListComponent {
	@Input() tooltipPosition: boolean;
	@Input() set team(value: MercenariesBattleTeam) {
		this.mercenaries = [...value.mercenaries].sort((a, b) => (a.isDead < b.isDead ? -1 : 1));
		if (!(this.cdr as ViewRef)?.destroyed) {
			this.cdr?.detectChanges();
		}
	}

	mercenaries: readonly BattleMercenary[];

	constructor(private readonly cdr: ChangeDetectorRef) {}
}
