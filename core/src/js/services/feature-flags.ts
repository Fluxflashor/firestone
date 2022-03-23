// When changing these feature flags, don't forget to update the new-version component
export class FeatureFlags {
	public static readonly ENABLE_DETAILED_MERC = false;
	public static readonly ENABLE_DUELS_OOC = true;
	public static readonly ENABLE_DUELS_DECK_BUILDER = false;

	// Shelved for now
	public static readonly ENABLE_MULTI_GRAPHS = false;
	public static readonly SHOW_CONSTRUCTED_SECONDARY_WINDOW = false; // Doesn't work anymore?
	public static readonly ENABLE_RANKED_ARCHETYPE = false; // Doesn't work anymore?
}
