import { moveFx } from "~/board/fx/moveFx";
import { runEffect } from "~/play/logic/runEffect";

export namespace move {
	export interface Props {
		boardItemId: string;
		x: number;
		y: number;
	}
}

export const move = ({ boardItemId, x, y }: move.Props) =>
	runEffect(
		moveFx({
			boardItemId,
			x,
			y,
		}),
	);
