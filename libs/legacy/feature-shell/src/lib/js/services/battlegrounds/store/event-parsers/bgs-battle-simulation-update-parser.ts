import * as deepmerge from 'deepmerge';
import { BattlegroundsState } from '../../../../models/battlegrounds/battlegrounds-state';
import { BgsFaceOffWithSimulation } from '../../../../models/battlegrounds/bgs-face-off-with-simulation';
import { BgsPanel } from '../../../../models/battlegrounds/bgs-panel';
import { BgsBattlesPanel } from '../../../../models/battlegrounds/in-game/bgs-battles-panel';
import { replaceInArray } from '../../../utils';
import { BgsBattleSimulationUpdateEvent } from '../events/bgs-battle-simulation-update-event';
import { BattlegroundsStoreEvent } from '../events/_battlegrounds-store-event';
import { EventParser } from './_event-parser';

export class BgsBattleSimulationUpdateParser implements EventParser {
	public applies(gameEvent: BattlegroundsStoreEvent, state: BattlegroundsState): boolean {
		return state && state.currentGame && gameEvent.type === 'BgsBattleSimulationUpdateEvent';
	}

	public async parse(
		currentState: BattlegroundsState,
		event: BgsBattleSimulationUpdateEvent,
	): Promise<BattlegroundsState> {
		const merged = BgsFaceOffWithSimulation.create(
			deepmerge(
				event.currentFaceOff as Partial<BgsFaceOffWithSimulation>,
				event.partialUpdate as Partial<BgsFaceOffWithSimulation>,
				{
					arrayMerge: (destinationArray, sourceArray, options) => sourceArray,
				},
			),
		);

		const panel: BgsBattlesPanel = currentState.panels.find(
			(p: BgsPanel) => p.id === 'bgs-battles',
		) as BgsBattlesPanel;
		const currentSimulationsIndex = panel.currentSimulations.map((s) => s.id).indexOf(merged.id);
		const newSimulations: readonly BgsFaceOffWithSimulation[] =
			currentSimulationsIndex >= 0
				? replaceInArray(panel.currentSimulations, currentSimulationsIndex, merged)
				: [...panel.currentSimulations, merged];

		const newPanel = panel.update({
			currentSimulations: newSimulations,
		} as BgsBattlesPanel);
		return currentState.updatePanel(newPanel);
	}
}
