import { Injectable } from '@angular/core';
import { BoosterType, CardIds, COIN_IDS } from '@firestone-hs/reference-data';
import { PackResult } from '@firestone-hs/user-packs';
import { ApiRunner, CardsFacadeService } from '@firestone/shared/framework/core';
import { GameStatusService } from '@legacy-import/src/lib/js/services/game-status.service';
import { PackStatsService } from '../../../libs/packs/services/pack-stats.service';
import { Card } from '../../models/card';
import { CardBack } from '../../models/card-back';
import { Coin } from '../../models/coin';
import { PackInfo } from '../../models/collection/pack-info';
import { CoinInfo } from '../../models/memory/coin-info';
import { Set, SetCard } from '../../models/set';
import { MemoryInspectionService } from '../plugins/memory-inspection.service';
import { CollectionStorageService } from './collection-storage.service';
import { SetsService } from './sets-service.service';

const CARD_BACKS_URL = 'https://static.zerotoheroes.com/hearthstone/data/card-backs.json';

@Injectable()
export class CollectionManager {
	public static EPIC_PITY_TIMER = 10;
	public static LEGENDARY_PITY_TIMER = 40;

	private referenceCardBacks: readonly CardBack[];

	constructor(
		private readonly memoryReading: MemoryInspectionService,
		private readonly db: CollectionStorageService,
		private readonly gameStatus: GameStatusService,
		private readonly api: ApiRunner,
		private readonly allCards: CardsFacadeService,
		private readonly setsService: SetsService,
		private readonly packStatsService: PackStatsService,
	) {
		this.init();
	}

	private lastCollectionRetrieveTimestamp = 0;
	private DEBOUNCE_COLLECTION_RETRIEVE_MS = 5000;

	public async getCollection(skipMemoryReading = false): Promise<readonly Card[]> {
		console.log(
			'[collection-manager] getting collection',
			skipMemoryReading,
			Date.now() - this.lastCollectionRetrieveTimestamp,
		);
		// So that we don't spam the memory reading when opening packs (where you can 5 new card events pretty quickly)
		skipMemoryReading =
			skipMemoryReading ||
			Date.now() - this.lastCollectionRetrieveTimestamp < this.DEBOUNCE_COLLECTION_RETRIEVE_MS;
		console.log('[collection-manager] skipMemoryReading', skipMemoryReading);
		const collection = !skipMemoryReading ? await this.memoryReading.getCollection() : null;
		if (!collection || collection.length === 0) {
			console.log('[collection-manager] retrieving collection from db');
			const collectionFromDb = await this.db.getCollection();
			console.log('[collection-manager] retrieved collection from db', collectionFromDb?.length);
			return collectionFromDb;
		} else {
			console.log('[collection-manager] retrieved collection from MindVision, updating collection in db');
			const savedCollection = await this.db.saveCollection(collection);
			this.lastCollectionRetrieveTimestamp = Date.now();
			return savedCollection;
		}
	}

	public async getBattlegroundsOwnedHeroSkinDbfIds(skipMemoryReading = false): Promise<readonly number[]> {
		console.log('[collection-manager] getBattlegroundsOwnedHeroSkinDbfIds', skipMemoryReading);
		const collection = !skipMemoryReading ? await this.memoryReading.getBattlegroundsOwnedHeroSkinDbfIds() : null;
		if (!collection || collection.length === 0) {
			console.log('[collection-manager] retrieving getBattlegroundsOwnedHeroSkinDbfIds from db');
			const collectionFromDb = await this.db.getBattlegroundsOwnedHeroSkinDbfIds();
			console.log(
				'[collection-manager] retrieved getBattlegroundsOwnedHeroSkinDbfIds from db',
				collectionFromDb?.length,
			);
			return collectionFromDb;
		} else {
			console.log(
				'[collection-manager] retrieved getBattlegroundsOwnedHeroSkinDbfIds from MindVision, updating collection in db',
			);
			const savedCollection = await this.db.saveBattlegroundsOwnedHeroSkinDbfIds(collection);
			return savedCollection;
		}
	}

	public async getPacks(): Promise<readonly PackInfo[]> {
		console.log('[collection-manager] getting pack info');
		const packInfo = (await this.memoryReading.getBoostersInfo()) ?? [];
		console.log('[collection-manager] retrieved pack info from memory', packInfo?.length);
		if (!packInfo || packInfo.length === 0) {
			console.log('[collection-manager] retrieving pack info from db');
			const packsFromDb = await this.db.getPackInfos();
			console.log('[collection-manager] retrieved pack info from db', packsFromDb?.length);
			return packsFromDb;
		} else {
			const saved = await this.db.savePackInfos(packInfo);
			// Checking for non-implemented booster IDs
			packInfo.forEach((p) => {
				const existingType = BoosterType[p.packType];
				if (!existingType) {
					console.warn('[collection-manager] missing pack type in enum', p.packType, p.totalObtained);
				}
			});
			return saved;
		}
	}

	public async getPackStats(): Promise<readonly PackResult[]> {
		return this.packStatsService.getPackStats();
	}

	public async getCardBacks(): Promise<readonly CardBack[]> {
		console.log('[collection-manager] getting reference card backs');
		this.referenceCardBacks = this.referenceCardBacks ?? (await this.api.callGetApi(CARD_BACKS_URL)) ?? [];
		console.log('[collection-manager] getting card backs', this.referenceCardBacks?.length);
		const cardBacks = await this.memoryReading.getCardBacks();
		console.log('[collection-manager] retrieved card backs from MindVision', cardBacks?.length);
		if (!cardBacks || cardBacks.length === 0) {
			console.log('[collection-manager] retrieving card backs from db');
			const cardBacksFromDb = await this.db.getCardBacks();
			console.log('[collection-manager] retrieved card backs from db', cardBacksFromDb?.length);
			// We do this so that if we update the reference, we still see them until the info
			// has been refreshed from the in-game memory
			const merged = this.mergeCardBacksData(this.referenceCardBacks, cardBacksFromDb);
			return merged;
		} else {
			const merged = this.mergeCardBacksData(this.referenceCardBacks, cardBacks);
			const saved = await this.db.saveCardBacks(merged);
			return saved;
		}
	}

	public async getCoins(): Promise<readonly Coin[]> {
		console.log('[collection-manager] getting coin');
		const memoryCoins: readonly CoinInfo[] = await this.memoryReading.getCoins();
		if (!memoryCoins || memoryCoins.length === 0) {
			console.log('[collection-manager] retrieving coins from db');
			const coinsFromDb = await this.db.getCoins();
			console.log('[collection-manager] retrieved coins from db', coinsFromDb?.length);
			return coinsFromDb;
		} else {
			const refCoins = this.allCards.getCards().filter((card) => COIN_IDS.includes(card.id as CardIds));
			const coins: readonly Coin[] = refCoins.map((coin) => ({
				cardId: coin.id,
				owned: memoryCoins.find((c) => c.CoinId === coin.dbfId) != null,
				cardDbfId: coin.dbfId,
			}));
			console.log('[collection-manager] updating coins in db');
			const saved = await this.db.saveCoins(coins);
			return saved;
		}
	}

	private mergeCardBacksData(
		referenceCardBacks: readonly CardBack[],
		ownedCardBacks: readonly CardBack[],
	): readonly CardBack[] {
		return referenceCardBacks.map((cardBack) => {
			const owned = ownedCardBacks.find((cb) => cb.id === cardBack.id);
			return owned?.owned
				? ({
						...cardBack,
						owned: true,
				  } as CardBack)
				: cardBack;
		});
	}

	// type is NORMAL or GOLDEN
	public inCollection(collection: Card[], cardId: string): Card {
		for (const card of collection) {
			if (card.id === cardId) {
				return card;
			}
		}
		return null;
	}

	public async buildSets(collection: readonly Card[]): Promise<readonly Set[]> {
		return this.buildSetsFromCollection(collection);
	}

	private async buildSetsFromCollection(collection: readonly Card[]): Promise<readonly Set[]> {
		return this.setsService
			.getAllSets()
			.map((set) => ({ set: set }))
			.map((set) => this.mergeSet(collection, set.set));
	}

	private mergeSet(collection: readonly Card[], set: Set): Set {
		const updatedCards: SetCard[] = this.mergeFullCards(collection, set.allCards);
		const ownedLimitCollectibleCards = updatedCards
			.map((card: SetCard) => card.getNumberCollected())
			.reduce((c1, c2) => c1 + c2, 0);
		const ownedLimitCollectiblePremiumCards = updatedCards
			.map((card: SetCard) => card.getNumberCollectedPremium())
			.reduce((c1, c2) => c1 + c2, 0);
		return new Set(
			set.id,
			set.name,
			set.launchDate,
			set.standard,
			updatedCards,
			ownedLimitCollectibleCards,
			ownedLimitCollectiblePremiumCards,
		);
	}

	private mergeFullCards(collection: readonly Card[], setCards: readonly SetCard[]): SetCard[] {
		return setCards.map((card: SetCard) => {
			const collectionCard: Card = collection.find((collectionCard: Card) => collectionCard.id === card.id);
			const ownedNonPremium = collectionCard ? collectionCard.count : 0;
			const ownedPremium = collectionCard ? collectionCard.premiumCount : 0;
			const ownedDiamond = collectionCard ? collectionCard.diamondCount : 0;
			const ownedSignature = collectionCard ? collectionCard.signatureCount : 0;
			return new SetCard(
				card.id,
				card.name,
				card.cardClass,
				card.rarity,
				card.cost,
				ownedNonPremium,
				ownedPremium,
				ownedDiamond,
				ownedSignature,
			);
		});
	}

	private init() {
		this.gameStatus.onGameStart(async () => {
			await Promise.all([this.getCollection(), this.getCardBacks(), this.getPacks()]);
		});
	}
}
