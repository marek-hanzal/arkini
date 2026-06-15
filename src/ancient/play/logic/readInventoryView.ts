import { readViewFx } from "~/inventory/fx/readViewFx";
import { runEffect } from "./runEffect";

export function readInventoryView() {
	return runEffect(readViewFx());
}
