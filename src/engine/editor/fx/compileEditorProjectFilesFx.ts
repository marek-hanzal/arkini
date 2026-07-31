import { Effect } from "effect";

import { compileGameSourcesFx } from "~/engine/compiler/fx/compileGameSourcesFx";
import { EditorProjectError } from "~/engine/editor/error/EditorProjectError";
import { assertEditorSourceFilePathsFx } from "~/engine/editor/fx/assertEditorSourceFilePathsFx";
import { EditorProjectCompilationSchema } from "~/engine/editor/schema/EditorProjectCompilationSchema";
import type { EditorSourceFileSchema } from "~/engine/editor/schema/EditorSourceFileSchema";
import { PayloadSchema } from "~/engine/pack/schema/PayloadSchema";
import { parseGameSourceFileFx } from "~/engine/source/fx/parseGameSourceFileFx";
import { GameValidationError } from "~/engine/validation/error/GameValidationError";
import { assertGameConfigValidFx } from "~/engine/validation/fx/assertGameConfigValidFx";
import { validateGameResourcesFx } from "~/engine/validation/rule/validateGameResourcesFx";
import { DiagnosticSeverityEnumSchema } from "~/engine/validation/schema/DiagnosticSeverityEnumSchema";

const readResourceId = (path: string) => path.slice(path.lastIndexOf("/") + 1, -".png".length);

/** Recompiles one editor project snapshot through the canonical source and resource validators. */
export const compileEditorProjectFilesFx = Effect.fn("compileEditorProjectFilesFx")(function* (
	files: ReadonlyArray<EditorSourceFileSchema.Type>,
) {
	yield* assertEditorSourceFilePathsFx(files);
	const unsupported = files.find(
		(file) => !file.path.endsWith(".json") && !file.path.endsWith(".png"),
	);
	if (unsupported !== undefined) {
		return yield* Effect.fail(
			new EditorProjectError({
				reason: "unsupported-project-file",
				message: `Unsupported editor project file ${unsupported.path}.`,
			}),
		);
	}

	const parsed = yield* Effect.forEach(
		files.filter((file) => file.path.endsWith(".json")),
		(file) =>
			parseGameSourceFileFx({
				path: file.path,
				source: new TextDecoder().decode(file.bytes),
			}),
	);
	const compilation = yield* compileGameSourcesFx(
		parsed.flatMap((result) =>
			result.source === undefined
				? []
				: [
						result.source,
					],
		),
	);
	const combined = {
		...compilation,
		diagnostics: [
			...parsed.flatMap((result) => result.diagnostics),
			...compilation.diagnostics,
		],
	};
	const config = yield* assertGameConfigValidFx(combined);
	const resources = files
		.filter((file) => file.path.endsWith(".png"))
		.map((file) => ({
			id: readResourceId(file.path),
			mime: "image/png" as const,
			bytes: file.bytes,
			path: file.path,
		}))
		.sort((left, right) => (left.id < right.id ? -1 : left.id > right.id ? 1 : 0));
	const resourceDiagnostics = yield* validateGameResourcesFx({
		config,
		provenance: compilation.provenance,
		resources: resources.map(({ id, mime, path }) => ({
			id,
			mime,
			path,
		})),
	});
	const diagnostics = [
		...combined.diagnostics,
		...resourceDiagnostics,
	];
	const errors = diagnostics.filter(
		(diagnostic) => diagnostic.severity === DiagnosticSeverityEnumSchema.enum.Error,
	);
	if (errors.length > 0) {
		return yield* Effect.fail(
			new GameValidationError({
				diagnostics: errors,
			}),
		);
	}

	return EditorProjectCompilationSchema.parse({
		payload: PayloadSchema.parse({
			config,
			resources: resources.map(({ id, mime, bytes }) => ({
				id,
				mime,
				bytes,
			})),
		}),
		diagnostics,
		provenance: compilation.provenance,
		resourcePaths: Object.fromEntries(
			resources.map(({ id, path }) => [
				id,
				path,
			]),
		),
	});
});
