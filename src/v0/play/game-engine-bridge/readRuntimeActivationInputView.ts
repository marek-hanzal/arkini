import type { ActivationInputView } from "~/v0/board/view/ActivationInputViewSchema";
import type { ItemId } from "~/v0/game/config/GameIdSchema";

export namespace readRuntimeActivationInputView {
	export interface Props {
		input: {
			capacity: number;
			consume: boolean;
			itemId: string;
			quantity: number;
		};
		stored: number;
	}
}

export const readRuntimeActivationInputView = ({
	input,
	stored,
}: readRuntimeActivationInputView.Props): ActivationInputView => ({
	capacity: input.capacity,
	consume: input.consume,
	itemId: input.itemId as ItemId,
	quantity: input.quantity,
	stored,
});
