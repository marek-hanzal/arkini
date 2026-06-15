import { readSaveFx } from "../fx/readSaveFx";
import { runEffect } from "./runEffect";

export function readGameSaveView() {
	return runEffect(readSaveFx());
}
