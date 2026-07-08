import { Effect } from "effect";
import {
	readCraftRecipeDefinition,
	type GameCraftRecipeDefinition,
} from "~/config/GameItemCapabilities";
import { GameEngineError } from "~/engine/model/GameEngineError";
import { readCraftOutputItemIds } from "~/craft/readCraftRecipeOutput";
import type { GameSaveBoardItem, GameSaveCraftJob } from "~/engine/model/GameSaveSchema";
import type {
	CraftCompletionTarget,
	CraftJobCompletionScope,
} from "~/craft/CraftJobCompletionTypes";

const readCraftCompletionRecipeFx = Effect.fn("readCraftCompletionRecipeFx")(function* ({
	liveJob,
	scope,
}: {
	liveJob: GameSaveCraftJob;
	scope: CraftJobCompletionScope;
}) {
	const recipe = readCraftRecipeDefinition({
		config: scope.config,
		recipeId: liveJob.recipeId,
	});
	if (recipe) return recipe;

	return yield* Effect.fail(
		GameEngineError.configReferenceMissing(`Missing craft recipe "${liveJob.recipeId}".`),
	);
});

const readCraftCompletionBoardItemFx = Effect.fn("readCraftCompletionBoardItemFx")(function* ({
	liveJob,
	scope,
}: {
	liveJob: GameSaveCraftJob;
	scope: CraftJobCompletionScope;
}) {
	const liveTarget = scope.save.board.items[liveJob.targetItemInstanceId];
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
	recipe,
	scope,
}: {
	recipe: GameCraftRecipeDefinition;
	scope: CraftJobCompletionScope;
}) {
	for (const outputItemId of readCraftOutputItemIds(recipe)) {
		if (scope.config.items[outputItemId]) continue;

		return yield* Effect.fail(
			GameEngineError.configReferenceMissing(`Missing craft output item "${outputItemId}".`),
		);
	}
});

export const readCraftCompletionTargetFx = Effect.fn("readCraftCompletionTargetFx")(function* ({
	liveJob,
	scope,
}: {
	liveJob: GameSaveCraftJob;
	scope: CraftJobCompletionScope;
}) {
	const recipe = yield* readCraftCompletionRecipeFx({
		liveJob,
		scope,
	});
	const liveTarget = yield* readCraftCompletionBoardItemFx({
		liveJob,
		scope,
	});
	yield* assertCraftCompletionTargetMatchesRecipeFx({
		liveJob,
		liveTarget,
	});
	yield* assertCraftOutputItemsExistFx({
		recipe,
		scope,
	});
	return {
		liveJob,
		liveTarget,
		recipe,
	} satisfies CraftCompletionTarget;
});
