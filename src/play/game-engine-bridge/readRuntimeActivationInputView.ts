import type { ActivationInputView } from "~/board/view/ActivationInputViewSchema";
import type { ItemId } from "~/config/IdSchema";
import { readActivationInputMode } from "~/activation/readActivationInputMode";

export namespace readRuntimeActivationInputView {
	export interface Props {
		input: {
			capacity: number;
			consume: boolean;
			itemId: string;
			quantity: number;
			mode?: "exact" | "upTo";
		};
		stored: number;
		available?: number;
	}
}

export const readRuntimeActivationInputView = ({
	input,
	available,
	stored,
}: readRuntimeActivationInputView.Props): ActivationInputView => ({
	capacity: input.capacity,
	consume: input.consume,
	itemId: input.itemId as ItemId,
	mode: readActivationInputMode(input),
	quantity: input.quantity,
	stored,
	available,
});
