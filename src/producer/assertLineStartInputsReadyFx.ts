import { Effect } from "effect";
import { match } from "ts-pattern";
import { checkActivationInputsFx } from "~/activation/checkActivationInputsFx";
import { readGameItemQuantity } from "~/quantity/GameItemQuantityIndex";
import type {
	LineStartDefinition,
	LineStartReadinessScope,
} from "~/producer/LineStartReadinessTypes";
import { planLineAutoFillInputRefsFx } from "~/producer/planLineAutoFillInputRefsFx";
import { readLineStoredInputQuantitiesFx } from "~/producer/readLineStoredInputQuantitiesFx";

const assertExplicitLineInputsReadyFx = Effect.fn(
	"checkLineStartReadinessFx.assertExplicitLineInputsReadyFx",
)(function* (scope: LineStartReadinessScope, { lineInputs }: LineStartDefinition) {
	const { action, save } = scope;
	yield* checkActivationInputsFx({
		inputRefs: action.inputRefs,
		inputs: lineInputs,
		save,
	});
});

const assertStoredOrAutoFilledLineInputsReadyFx = Effect.fn(
	"checkLineStartReadinessFx.assertStoredOrAutoFilledLineInputsReadyFx",
)(function* (scope: LineStartReadinessScope, { lineId, lineInputs }: LineStartDefinition) {
	const { action, save } = scope;
	const storedInputs = yield* readLineStoredInputQuantitiesFx({
		itemInstanceId: action.itemInstanceId,
		lineId,
		save,
	});
	const needsAutoFill = lineInputs.some(
		(input) =>
			readGameItemQuantity({
				itemId: input.itemId,
				quantities: storedInputs,
			}) < input.quantity,
	);
	if (!needsAutoFill) return;

	yield* planLineAutoFillInputRefsFx({
		inputs: lineInputs,
		itemInstanceId: action.itemInstanceId,
		lineId,
		save,
	});
});

export const assertLineStartInputsReadyFx = Effect.fn(
	"checkLineStartReadinessFx.assertLineInputsReadyFx",
)(function* (scope: LineStartReadinessScope, definition: LineStartDefinition) {
	const { action } = scope;
	yield* match(action.inputRefs.length > 0)
		.with(true, () => assertExplicitLineInputsReadyFx(scope, definition))
		.with(false, () => assertStoredOrAutoFilledLineInputsReadyFx(scope, definition))
		.exhaustive();
});
