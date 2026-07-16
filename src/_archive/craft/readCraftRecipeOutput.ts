import type { GameCraftRecipeDefinition } from "~/config/GameItemCapabilities";

type CraftOutputSet = GameCraftRecipeDefinition["output"][number];
type CraftOutputEntry = CraftOutputSet["entries"][number];

const readCraftOutputEntryItemIds = (entry: CraftOutputEntry): string[] =>
	entry.type === "weighted"
		? entry.entries.map((weightedEntry) => weightedEntry.itemId)
		: [
				entry.itemId,
			];

export const readCraftOutputItemIds = (recipe: GameCraftRecipeDefinition): string[] =>
	recipe.output.flatMap((outputSet) => outputSet.entries.flatMap(readCraftOutputEntryItemIds));

export const readCraftPrimaryOutputItemId = (recipe: GameCraftRecipeDefinition): string => {
	const [primaryItemId] = readCraftOutputItemIds(recipe);
	return primaryItemId;
};

const craftOutputEntryContainsItemId = ({
	entry,
	itemId,
}: {
	entry: CraftOutputEntry;
	itemId: string;
}) =>
	entry.type === "weighted"
		? entry.entries.some((weightedEntry) => weightedEntry.itemId === itemId)
		: entry.itemId === itemId;

export const readCraftOutputEntriesForItemId = ({
	itemId,
	recipe,
}: {
	itemId: string;
	recipe: GameCraftRecipeDefinition;
}): CraftOutputEntry[] =>
	recipe.output.flatMap((outputSet) =>
		outputSet.entries.filter((entry) =>
			craftOutputEntryContainsItemId({
				entry,
				itemId,
			}),
		),
	);
