import { Effect } from "effect";

import { compileGameSourcesFx } from "./compileGameSourcesFx";
import { readGameSourceFilesFx } from "./readGameSourceFilesFx";
import { readResourceDescriptorsFx } from "~/engine/resource/fx/readResourceDescriptorsFx";
import { validateGameResourcesFn } from "~/engine/validation/rule/fn/validateGameResourcesFn";

export namespace compileGameDirectoryFx {
	export interface Props {
		input: string;
	}
}

/**
 * Reads one authoring directory and runs the canonical completed-game compiler.
 *
 * User-authored parse, assembly, schema, semantic, and resource problems accumulate
 * as provenance-aware diagnostics instead of failing fast. A parsed config may
 * therefore coexist with diagnostics; delivery callers own the explicit
 * `assertGameConfigValidFx` gate.
 */
export const compileGameDirectoryFx = Effect.fn("compileGameDirectoryFx")(function* ({
	input,
}: compileGameDirectoryFx.Props) {
	const sourceFiles = yield* readGameSourceFilesFx({
		input,
	});
	const resources = yield* readResourceDescriptorsFx({
		input,
	});
	const compilation = yield* compileGameSourcesFx(sourceFiles.sources);
	const diagnostics = [
		...sourceFiles.diagnostics,
		...compilation.diagnostics,
	];
	if (compilation.config === undefined) {
		return {
			...compilation,
			diagnostics,
			projectIdentity: sourceFiles.projectIdentity,
			resources,
			json: sourceFiles.sources.length,
		};
	}
	const resourceDiagnostics = validateGameResourcesFn({
		config: compilation.config,
		provenance: compilation.provenance,
		resources,
	});

	return {
		...compilation,
		projectIdentity: sourceFiles.projectIdentity,
		diagnostics: [
			...diagnostics,
			...resourceDiagnostics,
		],
		resources,
		json: sourceFiles.sources.length,
	};
});
