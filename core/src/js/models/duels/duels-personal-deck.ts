import { DuelsRun } from './duels-run';

export interface DuelsDeckSummary {
	readonly initialDeckList: string;
	readonly playerClass: string;
	readonly heroCardId: string;
	readonly global: DuelsDeckStatInfo;
	readonly deckStatsForTypes: readonly DuelsDeckSummaryForType[];
	readonly runs: readonly DuelsRun[];
}

export interface DuelsDeckSummaryForType {
	readonly type: 'duels' | 'paid-duels';
	readonly global: DuelsDeckStatInfo;
	readonly heroPowerStats: readonly HeroPowerDuelsDeckStatInfo[];
	readonly signatureTreasureStats: readonly SignatureTreasureDuelsDeckStatInfo[];
}

export interface DuelsDeckStatInfo {
	readonly totalRunsPlayed: number;
	readonly totalMatchesPlayed: number;
	readonly averageWinsPerRun: number;
	readonly winsDistribution: readonly { winNumber: number; value: number }[];
	readonly winrate: number;
	readonly netRating: number;
}

export interface HeroPowerDuelsDeckStatInfo extends DuelsDeckStatInfo {
	readonly heroPowerCardId: string;
}

export interface SignatureTreasureDuelsDeckStatInfo extends DuelsDeckStatInfo {
	readonly signatureTreasureCardId: string;
}
