import { readViewFx } from "~/upgrade/fx/readViewFx";
import { runEffect } from "./runEffect";

export function readUpgradeListView() {
	return runEffect(readViewFx());
}
