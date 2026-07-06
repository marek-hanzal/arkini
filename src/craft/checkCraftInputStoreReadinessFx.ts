import { Effect } from "effect";
import { assertResolvedInputRefIsNotBoardItemFx } from "~/activation/assertResolvedInputRefIsNotBoardItemFx";
import { resolveSingleInputRefFx } from "~/activation/resolveSingleInputRefFx";
import type { GameActionResolvedInputRef } from "~/action/GameActionResolvedInputRef";
import type { GameActionCraftInputStoreSchema } from "~/action/GameActionCraftInputStoreSchema";
import type { GameConfig } from "~/config/GameConfigTypes";
import type { GameCraftRecipeDefinition } from "~/config/GameItemCapabilities";
import { checkCraftTargetIdleFx } from "~/craft/checkCraftTargetIdleFx";
import { readCraftBoardItemFx } from "~/craft/readCraftBoardItemFx";
import { readCraftInputQuantitiesFx } from "~/craft/readCraftInputQuantitiesFx";
import { GameEngineError } from "~/engine/model/GameEngineError";
import type { GameSave } from "~/engine/model/GameSaveSchema";
import { readGameItemQuantity } from "~/quantity/GameItemQuantityIndex";

export namespace checkCraftInputStoreReadinessFx {
	export interface Props {
		config: GameConfig;
		nowMs?: number;
		save: GameSave;
		action: GameActionCraftInputStoreSchema.Type;
	}
}

type CraftInputStoreTarget = {
	recipe: GameCraftRecipeDefinition;
	recipeId: string;
	targetItem: NonNullable<GameSave["board"]["items"][string]>;
};
type CraftInputSlot = GameCraftRecipeDefinition["inputs"][number];

type CraftInputStoreQuantityCandidate = {
	inputSlot: CraftInputSlot;
	nextQuantity: number;
	previousQuantity: number;
	resolvedRef: GameActionResolvedInputRef;
};

type CraftInputStoreReadinessScope = checkCraftInputStoreReadinessFx.Props & {
	readonly resolvedRef: GameActionResolvedInputRef;
	readonly target: CraftInputStoreTarget;
};

const readCraftInputStoreTargetFx = Effect.fn(
	"checkCraftInputStoreReadinessFx.readCraftInputStoreTargetFx",
)(function* ({ action, config, save }: checkCraftInputStoreReadinessFx.Props) {
	const target = yield* readCraftBoardItemFx({
		config,
		save,
		targetItemInstanceId: action.targetItemInstanceId,
	});
	yield* checkCraftTargetIdleFx({
		save,
		targetItemInstanceId: action.targetItemInstanceId,
	});
	return target;
});

const readCraftInputStoreResolvedRefFx = Effect.fn(
	"checkCraftInputStoreReadinessFx.readCraftInputStoreResolvedRefFx",
)(function* ({ action, save }: Pick<checkCraftInputStoreReadinessFx.Props, "action" | "save">) {
	const resolvedRef = yield* resolveSingleInputRefFx({
		inputRef: action.inputRef,
		missingMessage: "Missing craft input.",
		save,
	});
	yield* assertResolvedInputRefIsNotBoardItemFx({
		inputRef: resolvedRef,
		message: "Craft input target cannot store itself.",
		targetItemInstanceId: action.targetItemInstanceId,
	});
	return resolvedRef;
});

const readCraftInputStoreSlotFx = Effect.fn(
	"checkCraftInputStoreReadinessFx.readCraftInputStoreSlotFx",
)(function* ({ resolvedRef, target }: CraftInputStoreReadinessScope) {
	const inputSlot = target.recipe.inputs.find((input) => input.itemId === resolvedRef.itemId);
	if (inputSlot) return inputSlot;

	return yield* Effect.fail(
		GameEngineError.actionRejected(
			"input_mismatch",
			`Craft input "${resolvedRef.itemId}" is not accepted by recipe "${target.recipeId}".`,
		),
	);
});

const readCraftInputStoreQuantityCandidateFx = Effect.fn(
	"checkCraftInputStoreReadinessFx.readCraftInputStoreQuantityCandidateFx",
)(function* ({
	inputSlot,
	scope,
}: {
	inputSlot: CraftInputSlot;
	scope: CraftInputStoreReadinessScope;
}) {
	const storedInputs = yield* readCraftInputQuantitiesFx({
		save: scope.save,
		targetItemInstanceId: scope.action.targetItemInstanceId,
	});
	const previousQuantity = readGameItemQuantity({
		itemId: scope.resolvedRef.itemId,
		quantities: storedInputs,
	});
	const remainingQuantity = inputSlot.quantity - previousQuantity;
	const storedQuantity = Math.min(scope.resolvedRef.quantity, remainingQuantity);
	if (storedQuantity > 0) {
		const nextQuantity = previousQuantity + storedQuantity;
		return {
			inputSlot,
			nextQuantity,
			previousQuantity,
			resolvedRef: {
				...scope.resolvedRef,
				quantity: storedQuantity,
			},
		} satisfies CraftInputStoreQuantityCandidate;
	}

	return yield* Effect.fail(
		GameEngineError.actionRejected(
			"input_mismatch",
			`Craft input "${scope.resolvedRef.itemId}" capacity exceeded (${previousQuantity + scope.resolvedRef.quantity}/${inputSlot.quantity}).`,
		),
	);
});

const checkCraftInputStoreReadinessProgramFx = Effect.fn(
	"checkCraftInputStoreReadinessFx.checkCraftInputStoreReadinessProgramFx",
)(function* (scope: CraftInputStoreReadinessScope) {
	const inputSlot = yield* readCraftInputStoreSlotFx(scope);
	const quantityCandidate = yield* readCraftInputStoreQuantityCandidateFx({
		inputSlot,
		scope,
	});

	return {
		...quantityCandidate,
		target: scope.target,
	};
});

export const checkCraftInputStoreReadinessFx = Effect.fn("checkCraftInputStoreReadinessFx")(
	function* (props: checkCraftInputStoreReadinessFx.Props) {
		const target = yield* readCraftInputStoreTargetFx(props);
		const resolvedRef = yield* readCraftInputStoreResolvedRefFx(props);

		return yield* checkCraftInputStoreReadinessProgramFx({
			...props,
			resolvedRef,
			target,
		});
	},
);
