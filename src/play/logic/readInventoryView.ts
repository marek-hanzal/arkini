import { readViewFx } from "~/inventory/logic/fx/readViewFx";
import { runFx } from "./fx/runFx";

export function readInventoryView() {
	return runFx(readViewFx());
}
