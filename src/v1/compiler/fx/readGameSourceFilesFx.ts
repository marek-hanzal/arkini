import { Effect } from "effect";

import { collectSourceFilesFx } from "~/v1/pack/fx/collectSourceFilesFx";
import { readJsonSourceFx } from "~/v1/pack/fx/readJsonSourceFx";

export namespace readGameSourceFilesFx {
	export interface Props {
		input: string;
	}
}

/** Reads every JSON game source through the production fragment parser. */
export const readGameSourceFilesFx = Effect.fn("readGameSourceFilesFx")(function* ({
	input,
}: readGameSourceFilesFx.Props) {
	const sourceFiles = yield* collectSourceFilesFx({
		input,
	});
	const sources = yield* Effect.forEach(sourceFiles.json, (path) =>
		readJsonSourceFx({
			path,
		}),
	);

	return {
		root: sourceFiles.root,
		sources,
	} as const;
});
