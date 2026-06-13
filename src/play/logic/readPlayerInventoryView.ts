import { readInventoryFx } from "~/player/fx/readInventoryFx";
import { runEffect } from "./runEffect";

export function readPlayerInventoryView() {
	return runEffect(readInventoryFx());
}
