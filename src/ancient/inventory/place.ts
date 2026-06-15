import { placeFx } from "~/inventory/fx/placeFx";
import { runEffect } from "~/play/logic/runEffect";

export namespace place {
	export interface Props {
		slotIndex: number;
		x: number;
		y: number;
	}
}

export const place = ({ slotIndex, x, y }: place.Props) =>
	runEffect(
		placeFx({
			slotIndex,
			x,
			y,
		}),
	);
