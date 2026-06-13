import { readRecipesFx } from "~/build/logic/fx/readRecipesFx";
import { runFx } from "./fx/runFx";

export function readBuildRecipeViews() {
	return runFx(readRecipesFx());
}
