import { Effect } from "effect";
import { assertResolvedInputRefIsNotBoardItemFx } from "~/activation/assertResolvedInputRefIsNotBoardItemFx";
import { readStoredActivationInputQuantityCandidateFx } from "~/activation/readStoredActivationInputQuantityCandidateFx";
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
)(function* ({
		resolvedRef,
		target,
	}: {
		resolvedRef: GameActionResolvedInputRef;
		target: CraftInputStoreTarget;
	}) {
		const inputSlot = target.recipe.inputs.find((input) => input.itemId === resolvedRef.itemId);
		if (inputSlot) return inputSlot;

		return yield* Effect.fail(
			GameEngineError.actionRejected(
				"input_mismatch",
				`Craft input "${resolvedRef.itemId}" is not accepted by recipe "${target.recipeId}".`,
			),
		);
	},
);

const readCraftInputStoreQuantityCandidateFx = Effect.fn(
	"checkCraftInputStoreReadinessFx.readCraftInputStoreQuantityCandidateFx",
)(function* ({
		action,
		save,
		resolvedRef,
		inputSlot,
	}: {
		action: GameActionCraftInputStoreSchema.Type;
		save: GameSave;
		resolvedRef: GameActionResolvedInputRef;
		inputSlot: CraftInputSlot;
	}) {
		const storedInputs = yield* readCraftInputQuantitiesFx({
			save,
			targetItemInstanceId: action.targetItemInstanceId,
		});
		const previousQuantity = readGameItemQuantity({
			itemId: resolvedRef.itemId,
			quantities: storedInputs,
		});
		const quantityCandidate = yield* readStoredActivationInputQuantityCandidateFx({
			capacity: inputSlot.quantity,
			previousQuantity,
			resolvedRef,
		});
		if (quantityCandidate) {
			return {
				inputSlot,
				...quantityCandidate,
			} satisfies CraftInputStoreQuantityCandidate;
		}

		return yield* Effect.fail(
			GameEngineError.actionRejected(
				"input_mismatch",
				`Craft input "${resolvedRef.itemId}" capacity exceeded (${previousQuantity + resolvedRef.quantity}/${inputSlot.quantity}).`,
			),
		);
	},
);

export const checkCraftInputStoreReadinessFx = Effect.fn("checkCraftInputStoreReadinessFx")(
	function* ({ action, config, nowMs, save }: checkCraftInputStoreReadinessFx.Props) {
		const target = yield* readCraftInputStoreTargetFx({
			action,
			config,
			nowMs,
			save,
		});
		const resolvedRef = yield* readCraftInputStoreResolvedRefFx({
			action,
			save,
		});
		const inputSlot = yield* readCraftInputStoreSlotFx({
			resolvedRef,
			target,
		});
		const quantityCandidate = yield* readCraftInputStoreQuantityCandidateFx({
			action,
			save,
			resolvedRef,
			inputSlot,
		});

		return {
			...quantityCandidate,
			target,
		};
	},
);
