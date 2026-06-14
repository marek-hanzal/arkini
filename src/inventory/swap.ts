import { swapFx } from "~/inventory/fx/swapFx";
import { runEffect } from "~/play/logic/runEffect";

export namespace swap {
	export interface Props {
		sourceSlotIndex: number;
		targetSlotIndex: number;
	}
}

export const swap = ({ sourceSlotIndex, targetSlotIndex }: swap.Props) =>
	runEffect(
		swapFx({
			sourceSlotIndex,
			targetSlotIndex,
		}),
	);
