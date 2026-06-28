import type { ActivationInputView } from "~/v0/board/view/ActivationInputViewSchema";
import type { ItemId } from "~/v0/game/config/GameIdSchema";
import { readActivationInputMode } from "~/v0/game/requirements/readActivationInputMode";

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
