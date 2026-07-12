import { Effect } from "effect";

import { compileGameSourcesFx } from "./compileGameSourcesFx";
import { readGameSourceFilesFx } from "./readGameSourceFilesFx";
import { readResourceDescriptorsFx } from "~/v1/resource/fx/readResourceDescriptorsFx";
import { validateGameResourcesFx } from "~/v1/validation/rule/validateGameResourcesFx";

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
			resources,
			json: sourceFiles.sources.length,
		};
	}
	const resourceDiagnostics = yield* validateGameResourcesFx({
		config: compilation.config,
		provenance: compilation.provenance,
		resources,
	});

	return {
		...compilation,
		diagnostics: [
			...diagnostics,
			...resourceDiagnostics,
		],
		resources,
		json: sourceFiles.sources.length,
	};
});
