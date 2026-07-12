import { Effect } from "effect";

import { collectSourceFilesFx } from "~/v1/source/fx/collectSourceFilesFx";
import { readGameSourceFileFx } from "~/v1/source/fx/readGameSourceFileFx";
import type { GameDiagnosticsSchema } from "~/v1/validation/schema/GameDiagnosticsSchema";

export namespace readGameSourceFilesFx {
	export interface Props {
		input: string;
	}
}

/** Reads every JSON game source while collecting malformed-source diagnostics. */
export const readGameSourceFilesFx = Effect.fn("readGameSourceFilesFx")(function* ({
	input,
}: readGameSourceFilesFx.Props) {
	const sourceFiles = yield* collectSourceFilesFx({
		input,
	});
	const results = yield* Effect.forEach(sourceFiles.json, (path) =>
		readGameSourceFileFx({
			path,
		}),
	);
	const diagnostics: GameDiagnosticsSchema.Type = [];
	const sources = [];
	for (const result of results) {
		diagnostics.push(...result.diagnostics);
		if (result.source !== undefined) sources.push(result.source);
	}

	return {
		root: sourceFiles.root,
		sources,
		diagnostics,
	} as const;
});
