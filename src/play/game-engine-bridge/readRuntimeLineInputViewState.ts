import type { LineView } from "~/board/view/LineViewSchema";
import { readActivationInputRequiredQuantity } from "~/activation/readActivationInputRequiredQuantity";
import type { GameLineDefinition } from "~/config/GameItemCapabilities";
import type { GameSave } from "~/engine/model/GameSaveSchema";
import { readRuntimeActivationInputAvailableQuantityFromGameSave } from "~/play/game-engine-bridge/readRuntimeActivationInputAvailableQuantityFromGameSave";
import { readRuntimeActivationInputView } from "~/play/game-engine-bridge/readRuntimeActivationInputView";
import { readRuntimeStoredLineInputQuantityFromGameSave } from "~/play/game-engine-bridge/readRuntimeStoredLineInputQuantityFromGameSave";

export type RuntimeLineInputViewState = Pick<
	LineView,
	"inputItemIds" | "inputs" | "inputsAvailable" | "inputsReady"
>;

export namespace readRuntimeLineInputViewState {
	export interface Props {
		line: GameLineDefinition;
		lineId: string;
		save: GameSave;
		targetItemInstanceId: string;
	}
}

type RuntimeLineInputFacts = ReturnType<typeof readRuntimeActivationInputView> & {
	requiredQuantity: number;
};

export const readRuntimeLineInputViewState = ({
	line,
	lineId,
	save,
	targetItemInstanceId,
}: readRuntimeLineInputViewState.Props): RuntimeLineInputViewState => {
	const inputs: RuntimeLineInputFacts[] = (line.inputs ?? []).map((input) => {
		const available = readRuntimeActivationInputAvailableQuantityFromGameSave({
			itemId: input.itemId,
			save,
			targetItemInstanceId,
		});
		const stored = readRuntimeStoredLineInputQuantityFromGameSave({
			itemId: input.itemId,
			lineId,
			save,
			targetItemInstanceId,
		});
		const inputView = readRuntimeActivationInputView({
			available,
			input,
			stored,
		});

		return {
			...inputView,
			requiredQuantity: readActivationInputRequiredQuantity(inputView),
		};
	});

	return {
		inputItemIds: inputs.map((input) => input.itemId),
		inputs,
		inputsReady: inputs.every((input) => input.stored >= input.requiredQuantity),
		inputsAvailable: inputs.every(
			(input) => input.stored + (input.available ?? 0) >= input.requiredQuantity,
		),
	};
};
