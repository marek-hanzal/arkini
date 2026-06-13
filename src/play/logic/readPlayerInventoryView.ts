import { readInventoryFx } from "~/player/logic/fx/readInventoryFx";
import { runFx } from "./fx/runFx";

export function readPlayerInventoryView() {
	return runFx(readInventoryFx());
}
