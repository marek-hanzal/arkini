import { readSaveFx } from "./fx/readSaveFx";
import { runFx } from "./fx/runFx";

export function readGameSaveView() {
	return runFx(readSaveFx());
}
