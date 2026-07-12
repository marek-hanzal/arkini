import { Effect } from "effect";

import { compileGameSourcesFx } from "./compileGameSourcesFx";
import { readGameSourceFilesFx } from "./readGameSourceFilesFx";

export namespace compileGameDirectoryFx {
	export interface Props {
		input: string;
	}
}

/** Reads one authoring directory and runs the canonical completed-game compiler. */
export const compileGameDirectoryFx = Effect.fn("compileGameDirectoryFx")(function* ({
	input,
}: compileGameDirectoryFx.Props) {
	const sourceFiles = yield* readGameSourceFilesFx({
		input,
	});

	return yield* compileGameSourcesFx(sourceFiles.sources);
});
