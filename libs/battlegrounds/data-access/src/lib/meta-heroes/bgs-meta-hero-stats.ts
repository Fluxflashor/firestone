/* eslint-disable no-mixed-spaces-and-tabs */
import { BgsHeroTier, MmrPercentile } from '@firestone-hs/bgs-global-stats';
import { WithMmrAndTimePeriod } from '@firestone-hs/bgs-global-stats/dist/quests-v2/charged-stat';
import { BgsGlobalHeroStat } from '@firestone-hs/bgs-global-stats/dist/stats-v2/bgs-hero-stat';
import { ALL_BG_RACES, CardIds, getHeroPower, normalizeHeroCardId, Race } from '@firestone-hs/reference-data';
import { getStandardDeviation, groupByFunction, sortByProperties } from '@firestone/shared/framework/common';
import { CardsFacadeService, ILocalizationService } from '@firestone/shared/framework/core';
import { GameStat } from '@firestone/stats/data-access';
import { BgsMetaHeroStatTier, BgsMetaHeroStatTierItem } from './meta-heroes.model';

export const enhanceHeroStat = (
	hero: BgsMetaHeroStatTierItem,
	bgGames: readonly GameStat[],
	allCards: CardsFacadeService,
): BgsMetaHeroStatTierItem => {
	const gamesForHero = bgGames.filter(
		(g) =>
			normalizeHeroCardId(g.playerCardId, allCards.getService()) ===
			normalizeHeroCardId(hero.id, allCards.getService()),
	);
	const mmrDeltas = gamesForHero.map((g) => buildNetMmr(g)).filter((mmr) => mmr != null);
	const mmrDeltasPositive = mmrDeltas.filter((d) => d > 0);
	const mmrDeltasNegative = mmrDeltas.filter((d) => d < 0);
	const rawPlayerPlacementDistribution = buildPlayerPlacementDistribution(gamesForHero);
	const totalMatches = rawPlayerPlacementDistribution.map((p) => p.totalMatches).reduce((a, b) => a + b, 0);
	const playerPlacementDistribution: readonly { rank: number; percentage: number }[] =
		rawPlayerPlacementDistribution.map((p) => ({
			rank: p.rank,
			percentage: (100 * p.totalMatches) / totalMatches,
		}));
	return {
		...hero,
		playerDataPoints: gamesForHero.length,
		playerAveragePosition:
			gamesForHero.length === 0
				? null
				: gamesForHero.map((g) => parseInt(g.additionalResult)).reduce((a, b) => a + b, 0) /
				  gamesForHero.length,
		playerNetMmr: mmrDeltas.length === 0 ? null : mmrDeltas.reduce((a, b) => a + b, 0) / mmrDeltas.length,
		playerPlacementDistribution: playerPlacementDistribution,
		playerAverageMmrGain:
			mmrDeltasPositive.length === 0
				? null
				: mmrDeltasPositive.reduce((a, b) => a + b, 0) / mmrDeltasPositive.length,
		playerAverageMmrLoss:
			mmrDeltasNegative.length === 0
				? null
				: mmrDeltasNegative.reduce((a, b) => a + b, 0) / mmrDeltasNegative.length,
		playerLastPlayedTimestamp:
			gamesForHero.length === 0
				? null
				: gamesForHero.sort(sortByProperties((g) => [-g.creationTimestamp]))[0].creationTimestamp,
		playerTop1:
			gamesForHero.length === 0
				? null
				: (100 * gamesForHero.filter((g) => parseInt(g.additionalResult) === 1).length) / gamesForHero.length,
		playerTop4:
			gamesForHero.length === 0
				? null
				: (100 * gamesForHero.filter((g) => parseInt(g.additionalResult) <= 4).length) / gamesForHero.length,
	};
};

const buildPlayerPlacementDistribution = (
	playerGamesPlayed: GameStat[],
): readonly { rank: number; totalMatches: number }[] => {
	const groupedByFinish: { [rank: string]: readonly GameStat[] } = groupByFunction(
		(stat: GameStat) => stat.additionalResult,
	)(playerGamesPlayed.filter((stat) => !!stat.additionalResult));
	const result = [];
	for (let i = 1; i <= 8; i++) {
		result.push({
			rank: i,
			totalMatches: groupedByFinish['' + i]?.length ?? 0,
		});
	}
	return result;
};

const buildNetMmr = (game: GameStat): number => {
	if (!game.playerRank || !game.newPlayerRank) {
		return null;
	}
	return parseInt(game.newPlayerRank) - parseInt(game.playerRank);
};

export const buildTiers = (
	stats: readonly BgsMetaHeroStatTierItem[],
	i18n: ILocalizationService,
	localize = true,
): readonly BgsMetaHeroStatTier[] => {
	console.debug('buildTiers', stats);
	if (!stats?.length) {
		return [];
	}

	const heroStats = [...stats].sort(sortByProperties((s) => [s.averagePosition]));
	console.debug('heroStats', heroStats);
	const { mean, standardDeviation } = getStandardDeviation(heroStats.map((stat) => stat.averagePosition));

	return [
		{
			id: 'S' as BgsHeroTier,
			label: localize ? i18n.translateString('app.battlegrounds.tier-list.tier', { value: 'S' }) : 'S',
			tooltip: i18n.translateString('app.duels.stats.tier-s-tooltip'),
			items: filterItems(heroStats, 0, mean - 3 * standardDeviation),
		},
		{
			id: 'A' as BgsHeroTier,
			label: localize ? i18n.translateString('app.battlegrounds.tier-list.tier', { value: 'A' }) : 'A',
			tooltip: i18n.translateString('app.duels.stats.tier-a-tooltip'),
			items: filterItems(heroStats, mean - 3 * standardDeviation, mean - 1.5 * standardDeviation),
		},
		{
			id: 'B' as BgsHeroTier,
			label: localize ? i18n.translateString('app.battlegrounds.tier-list.tier', { value: 'B' }) : 'B',
			tooltip: i18n.translateString('app.duels.stats.tier-b-tooltip'),
			items: filterItems(heroStats, mean - 1.5 * standardDeviation, mean),
		},
		{
			id: 'C' as BgsHeroTier,
			label: localize ? i18n.translateString('app.battlegrounds.tier-list.tier', { value: 'C' }) : 'C',
			tooltip: i18n.translateString('app.duels.stats.tier-c-tooltip'),
			items: filterItems(heroStats, mean, mean + standardDeviation),
		},
		{
			id: 'D' as BgsHeroTier,
			label: localize ? i18n.translateString('app.battlegrounds.tier-list.tier', { value: 'D' }) : 'D',
			tooltip: i18n.translateString('app.duels.stats.tier-d-tooltip'),
			items: filterItems(heroStats, mean + standardDeviation, mean + 2 * standardDeviation),
		},
		{
			id: 'E' as BgsHeroTier,
			label: localize ? i18n.translateString('app.battlegrounds.tier-list.tier', { value: 'E' }) : 'E',
			tooltip: i18n.translateString('app.duels.stats.tier-e-tooltip'),
			items: filterItems(heroStats, mean + 2 * standardDeviation, 8),
		},
	].filter((tier) => tier.items?.length);
};

export const buildHeroStats = (
	stats: readonly WithMmrAndTimePeriod<BgsGlobalHeroStat>[],
	mmrPercentile: MmrPercentile['percentile'],
	tribes: readonly Race[],
	useConservativeEstimate: boolean,
	allCards: CardsFacadeService,
): readonly BgsMetaHeroStatTierItem[] => {
	const statsForMmr = stats?.filter((s) => s.mmrPercentile === mmrPercentile) ?? [];
	console.debug('statsForMmr', statsForMmr, mmrPercentile, stats);
	return statsForMmr
		.filter((stat) => {
			// If the hero has one big dominant tribe, and the tribes list doesn't include it, filter out
			// that stat
			// We can still have some leftover stats in the data, but that it very likely something bogus
			const overlyDominentTribes = stat.tribeStats
				.filter((t) => t.dataPoints > (4 / 5) * stat.dataPoints)
				// Temporary, because since undeads where omnipresent the stats are skewed
				.filter((t) => t.tribe !== Race.UNDEAD);
			const isIn =
				!overlyDominentTribes.length ||
				!tribes?.length ||
				overlyDominentTribes.every((t) => tribes.includes(t.tribe));
			const debug = stat.heroCardId === CardIds.SylvanasWindrunner_BG23_HERO_306;
			if (debug) {
				console.debug('isIn', isIn, stat.heroCardId, overlyDominentTribes, stat);
			}
			return isIn;
		})
		.map((stat) => {
			const useTribesModifier = !!tribes?.length && tribes.length !== ALL_BG_RACES.length;
			const tribeStatsToUse = useTribesModifier
				? stat.tribeStats
						.filter((t) => tribes.includes(t.tribe))
						// Remove some incorrect data points
						.filter((t) => t.dataPoints > stat.dataPoints / 20)
				: stat.tribeStats;

			const debug = stat.heroCardId === CardIds.SylvanasWindrunner_BG23_HERO_306;
			const tribesModifier = useTribesModifier
				? tribeStatsToUse?.map((t) => t.impactAveragePosition).reduce((a, b) => a + b, 0) ?? 0
				: 0;
			debug && console.debug('tribesModifier', tribesModifier, useTribesModifier, tribeStatsToUse, tribes, stat);

			let placementDistribution = stat.placementDistribution;
			let placementDistributionImpact = null;
			let combatWinrate = stat.combatWinrate;
			let combatWinrateImpact = null;
			let warbandStats = stat.warbandStats;
			let warbandStatsImpact = null;
			if (useTribesModifier) {
				placementDistributionImpact =
					stat.placementDistribution?.map((p) => {
						const rankImpact = tribeStatsToUse
							.flatMap((t) => t.impactPlacementDistribution)
							.filter((t) => t.rank === p.rank)
							.map((t) => t.impact)
							.reduce((a, b) => a + b, 0);
						return {
							rank: p.rank,
							percentage: rankImpact,
						};
					}) ?? 0;
				placementDistribution =
					stat.placementDistribution?.map((p) => {
						return {
							rank: p.rank,
							percentage:
								p.percentage +
								(placementDistributionImpact.find((t) => t.rank === p.rank).percentage ?? 0),
						};
					}) ?? [];

				combatWinrateImpact =
					stat.combatWinrate?.map((p) => {
						const turnImpact = tribeStatsToUse
							.flatMap((t) => t.impactCombatWinrate)
							.filter((t) => t.turn === p.turn)
							.map((t) => t.impact)
							.reduce((a, b) => a + b, 0);
						return {
							turn: p.turn,
							percentage: turnImpact,
						};
					}) ?? 0;
				combatWinrate =
					stat.combatWinrate?.map((p) => {
						return {
							turn: p.turn,
							winrate: p.winrate + (combatWinrateImpact.find((t) => t.turn === p.turn).winrate ?? 0),
						};
					}) ?? [];

				warbandStatsImpact =
					stat.warbandStats?.map((p) => {
						const turnImpact = tribeStatsToUse
							.flatMap((t) => t.impactWarbandStats)
							.filter((t) => t.turn === p.turn)
							.map((t) => t.impact)
							.reduce((a, b) => a + b, 0);
						return {
							turn: p.turn,
							averageStats: turnImpact,
						};
					}) ?? 0;
				warbandStats =
					stat.warbandStats?.map((p) => {
						return {
							turn: p.turn,
							averageStats:
								p.averageStats + (warbandStatsImpact.find((t) => t.turn === p.turn).averageStats ?? 0),
						};
					}) ?? [];

				debug && console.debug('warbandStats', warbandStats, warbandStatsImpact, stat.warbandStats);
			}

			const result: BgsMetaHeroStatTierItem = {
				id: stat.heroCardId,
				dataPoints: stat.dataPoints,
				averagePosition:
					(useConservativeEstimate ? stat.conservativePositionEstimate : stat.averagePosition) +
					tribesModifier,
				tribesFilter: tribes,
				positionTribesModifier: tribesModifier,
				placementDistribution: placementDistribution,
				placementDistributionImpact: placementDistributionImpact,
				combatWinrate: combatWinrate,
				combatWinrateImpact: combatWinrateImpact,
				warbandStats: warbandStats,
				warbandStatsImpact: warbandStatsImpact,

				tribeStats: tribeStatsToUse,

				name: allCards.getCard(stat.heroCardId)?.name,
				baseCardId: normalizeHeroCardId(stat.heroCardId, allCards.getService()),
				heroPowerCardId: getHeroPower(stat.heroCardId, allCards.getService()),
				top1: stat.placementDistribution
					.filter((p) => p.rank === 1)
					.map((p) => p.percentage)
					.reduce((a, b) => a + b, 0),
				top4: stat.placementDistribution
					.filter((p) => p.rank <= 4)
					.map((p) => p.percentage)
					.reduce((a, b) => a + b, 0),
			};
			return result;
		})
		.sort(sortByProperties((t) => [t.averagePosition]));
};

export const filterItems = (
	stats: readonly BgsMetaHeroStatTierItem[],
	threshold: number,
	upper: number,
): readonly BgsMetaHeroStatTierItem[] => {
	return stats
		.filter((stat) => stat.averagePosition)
		.filter((stat) => stat.averagePosition >= threshold && stat.averagePosition < upper);
};
