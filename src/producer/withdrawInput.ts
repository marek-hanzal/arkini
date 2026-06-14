import { runEffect } from "~/play/logic/runEffect";
import { withdrawInputFx } from "~/producer/fx/withdrawInputFx";

export namespace withdrawInput {
	export interface Props {
		boardItemId: string;
		itemId: string;
	}
}

export const withdrawInput = ({ boardItemId, itemId }: withdrawInput.Props) =>
	runEffect(
		withdrawInputFx({
			boardItemId,
			itemId,
		}),
	);
