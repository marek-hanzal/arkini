import { readRecipesFx } from "~/build/fx/readRecipesFx";
import { runEffect } from "./runEffect";

export function readBuildRecipeViews() {
	return runEffect(readRecipesFx());
}
