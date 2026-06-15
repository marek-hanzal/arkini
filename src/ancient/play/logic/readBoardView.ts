import { readViewFx } from "~/board/fx/readViewFx";
import { runEffect } from "./runEffect";

export function readBoardView() {
	return runEffect(readViewFx());
}
