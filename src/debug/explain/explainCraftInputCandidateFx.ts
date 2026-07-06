import { Effect } from "effect";
import type { GameActionCraftInputStoreSchema } from "~/action/GameActionCraftInputStoreSchema";
import type { GameConfig } from "~/config/GameConfigTypes";
import { checkCraftInputStoreReadinessFx } from "~/craft/checkCraftInputStoreReadinessFx";
import type { GameDebugExplanationStep } from "~/debug/explain/GameDebugExplanation";
import { readGameDebugExplanationOutcome } from "~/debug/explain/readGameDebugExplanationOutcome";
import type { GameSave } from "~/engine/model/GameSaveSchema";

export namespace explainCraftInputCandidateFx {
	export interface Props {
		action: GameActionCraftInputStoreSchema.Type;
		config: GameConfig;
		nowMs?: number;
		save: GameSave;
	}
}

const createInputRefDetails = ({ action }: Pick<explainCraftInputCandidateFx.Props, "action">) => ({
	inputKind: action.inputRef.kind,
	targetItemInstanceId: action.targetItemInstanceId,
	...(action.inputRef.kind === "board"
		? {
				inputBoardItemId: action.inputRef.itemInstanceId,
			}
		: {
				inputSlotIndex: action.inputRef.slotIndex,
			}),
});

export const explainCraftInputCandidateFx = Effect.fn("explainCraftInputCandidateFx")(function* (
	props: explainCraftInputCandidateFx.Props,
) {
	const steps: GameDebugExplanationStep[] = [
		{
			code: "craft_input_context",
			details: createInputRefDetails(props),
			message: "Explaining craft input candidate.",
			status: "info",
		},
	];
	const readinessEither = yield* Effect.either(checkCraftInputStoreReadinessFx(props));
	if (readinessEither._tag === "Left") {
		steps.push({
			code: `blocked_${readinessEither.left._tag}`,
			details: {
				message: readinessEither.left.message,
				reason: "reason" in readinessEither.left ? readinessEither.left.reason : undefined,
			},
			message: readinessEither.left.message,
			status: "blocked",
		});
	} else {
		const checked = readinessEither.right;
		steps.push({
			code: "accepted_craft_input_candidate",
			details: {
				acceptedQuantity: checked.resolvedRef.quantity,
				inputItemId: checked.resolvedRef.itemId,
				nextQuantity: checked.nextQuantity,
				previousQuantity: checked.previousQuantity,
				recipeId: checked.target.recipeId,
			},
			message: "Craft target can accept this input candidate.",
			status: "accepted",
		});
	}

	return {
		kind: "craft-input-candidate",
		outcome: readGameDebugExplanationOutcome(steps),
		steps,
	};
});
