import { BoosterType } from '@firestone-hs/reference-data';

export interface PackInfo {
	readonly BoosterId: BoosterType;
	readonly Cards: readonly CardPackInfo[];
}

export interface CardPackInfo {
	readonly CardId: string;
	readonly Premium: boolean;
	readonly TotalCount: number;
	readonly IsNew: boolean;
}
