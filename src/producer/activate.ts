import { runEffect } from "~/play/logic/runEffect";
import { produceFx } from "~/producer/fx/produceFx";

export namespace activate {
	export interface Props {
		boardItemId: string;
		activation?: "single" | "exhaust";
	}
}

export const activate = ({ boardItemId, activation = "single" }: activate.Props) =>
	runEffect(
		produceFx({
			boardItemId,
			activation,
		}),
	);
