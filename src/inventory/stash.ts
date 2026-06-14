import { stashFx } from "~/inventory/fx/stashFx";
import { runEffect } from "~/play/logic/runEffect";

export namespace stash {
	export interface Props {
		boardItemId: string;
		slotIndex?: number;
	}
}

export const stash = ({ boardItemId, slotIndex }: stash.Props) =>
	runEffect(
		stashFx({
			boardItemId,
			slotIndex,
		}),
	);
