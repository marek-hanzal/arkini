import { FileSystem } from "effect";
import { Effect } from "effect";

import { parseGameSourceFileFx } from "~/engine/source/fx/parseGameSourceFileFx";

export namespace readGameSourceFileFx {
	export interface Props {
		path: string;
		relative: string;
	}
}

/** Reads and parses one JSON authoring fragment from the active filesystem service. */
export const readGameSourceFileFx = Effect.fn("readGameSourceFileFx")(function* ({
	path,
	relative,
}: readGameSourceFileFx.Props) {
	const fileSystem = yield* FileSystem.FileSystem;
	return yield* parseGameSourceFileFx({
		path,
		relative,
		source: yield* fileSystem.readFileString(path),
	});
});
