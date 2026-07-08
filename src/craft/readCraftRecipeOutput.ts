import type { GameCraftRecipeDefinition } from "~/config/GameItemCapabilities";

type CraftOutputEntry = GameCraftRecipeDefinition["output"][number];

export const readCraftOutputItemIds = (recipe: GameCraftRecipeDefinition): string[] =>
	recipe.output.flatMap((entry) =>
		entry.type === "weighted"
			? entry.entries.map((weightedEntry) => weightedEntry.itemId)
			: [
					entry.itemId,
				],
	);

export const readCraftPrimaryOutputItemId = (recipe: GameCraftRecipeDefinition): string => {
	const [primaryItemId] = readCraftOutputItemIds(recipe);
	return primaryItemId;
};

export const readCraftOutputEntriesForItemId = ({
	itemId,
	recipe,
}: {
	itemId: string;
	recipe: GameCraftRecipeDefinition;
}): CraftOutputEntry[] =>
	recipe.output.filter((entry) =>
		entry.type === "weighted"
			? entry.entries.some((weightedEntry) => weightedEntry.itemId === itemId)
			: entry.itemId === itemId,
	);
