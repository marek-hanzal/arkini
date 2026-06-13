import { readViewFx } from "~/board/logic/fx/readViewFx";
import { runFx } from "./fx/runFx";

export function readBoardView() {
	return runFx(readViewFx());
}
