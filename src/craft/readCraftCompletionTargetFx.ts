import { Effect } from "effect";
import {
	readCraftRecipeDefinition,
	type GameCraftRecipeDefinition,
} from "~/config/GameItemCapabilities";
import { GameEngineError } from "~/engine/model/GameEngineError";
import { readCraftOutputItemIds } from "~/craft/readCraftRecipeOutput";
import type { GameConfig } from "~/config/GameConfigTypes";
import type { GameSave, GameSaveBoardItem, GameSaveCraftJob } from "~/engine/model/GameSaveSchema";
import type { CraftCompletionTarget } from "~/craft/CraftJobCompletionTypes";

const readCraftCompletionRecipeFx = Effect.fn("readCraftCompletionRecipeFx")(function* ({
	config,
	liveJob,
}: {
	config: GameConfig;
	liveJob: GameSaveCraftJob;
}) {
	const recipe = readCraftRecipeDefinition({
		config,
		recipeId: liveJob.recipeId,
	});
	if (recipe) return recipe;

	return yield* Effect.fail(
		GameEngineError.configReferenceMissing(`Missing craft recipe "${liveJob.recipeId}".`),
	);
});

const readCraftCompletionBoardItemFx = Effect.fn("readCraftCompletionBoardItemFx")(function* ({
	liveJob,
	save,
}: {
	liveJob: GameSaveCraftJob;
	save: GameSave;
}) {
	const liveTarget = save.board.items[liveJob.targetItemInstanceId];
	if (liveTarget) return liveTarget;

	return yield* Effect.fail(
		GameEngineError.saveInvalid(
			`Craft job "${liveJob.id}" target "${liveJob.targetItemInstanceId}" is missing.`,
		),
	);
});

const assertCraftCompletionTargetMatchesRecipeFx = Effect.fn(
	"assertCraftCompletionTargetMatchesRecipeFx",
)(function* ({
	liveJob,
	liveTarget,
}: {
	liveJob: GameSaveCraftJob;
	liveTarget: GameSaveBoardItem;
}) {
	if (liveTarget.itemId === liveJob.recipeId) return;

	return yield* Effect.fail(
		GameEngineError.saveInvalid(
			`Craft job "${liveJob.id}" target "${liveJob.targetItemInstanceId}" no longer matches recipe "${liveJob.recipeId}".`,
		),
	);
});

const assertCraftOutputItemsExistFx = Effect.fn("assertCraftOutputItemsExistFx")(function* ({
	config,
	recipe,
}: {
	config: GameConfig;
	recipe: GameCraftRecipeDefinition;
}) {
	for (const outputItemId of readCraftOutputItemIds(recipe)) {
		if (config.items[outputItemId]) continue;

		return yield* Effect.fail(
			GameEngineError.configReferenceMissing(`Missing craft output item "${outputItemId}".`),
		);
	}
});

export const readCraftCompletionTargetFx = Effect.fn("readCraftCompletionTargetFx")(function* ({
	config,
	liveJob,
	save,
}: {
	config: GameConfig;
	liveJob: GameSaveCraftJob;
	save: GameSave;
}) {
	const recipe = yield* readCraftCompletionRecipeFx({
		config,
		liveJob,
	});
	const liveTarget = yield* readCraftCompletionBoardItemFx({
		liveJob,
		save,
	});
	yield* assertCraftCompletionTargetMatchesRecipeFx({
		liveJob,
		liveTarget,
	});
	yield* assertCraftOutputItemsExistFx({
		config,
		recipe,
	});
	return {
		liveJob,
		liveTarget,
		recipe,
	} satisfies CraftCompletionTarget;
});
