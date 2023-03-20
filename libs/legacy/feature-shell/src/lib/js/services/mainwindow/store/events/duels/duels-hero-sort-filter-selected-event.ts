import { DuelsHeroSortFilterType } from '@firestone/duels/view';
import { MainWindowStoreEvent } from '../main-window-store-event';

export class DuelsHeroSortFilterSelectedEvent implements MainWindowStoreEvent {
	public static eventName(): string {
		return 'DuelsHeroSortFilterSelectedEvent';
	}

	constructor(public readonly value: DuelsHeroSortFilterType) {}

	public eventName(): string {
		return 'DuelsHeroSortFilterSelectedEvent';
	}

	public isNavigationEvent(): boolean {
		return false;
	}

	public isResetHistoryEvent(): boolean {
		return false;
	}
}
