import { Effect } from "effect";

import { EditorProjectManifestSchema } from "../../../electron/contract/editor/EditorProjectManifest";
import type { EditorProjectRecord } from "../../../electron/contract/editor/EditorProjectRecord";
import type { EditorProject } from "~/bridge/editor/EditorProject";
import { EditorProjectError } from "~/engine/editor/error/EditorProjectError";
import type { EditorProjectCompilationSchema } from "~/engine/editor/schema/EditorProjectCompilationSchema";

/** Joins one exact compiled source candidate with its manifest and persisted revision. */
export const createEditorProjectFromCompilationFx = Effect.fn(
	"createEditorProjectFromCompilationFx",
)(function* ({
	compilation,
	record,
	revision,
}: {
	readonly compilation: EditorProjectCompilationSchema.Type;
	readonly record: EditorProjectRecord;
	readonly revision: string;
}) {
	const manifestFile = record.files.find(({ path }) => path === "editor.json");
	const manifest = yield* Effect.try({
		try: () =>
			EditorProjectManifestSchema.parse(
				JSON.parse(
					new TextDecoder().decode(manifestFile?.bytes ?? new Uint8Array()),
				) as unknown,
			),
		catch: (cause) =>
			new EditorProjectError({
				reason: "unsupported-project-file",
				message: `Editor project ${record.projectId} contains an invalid editor.json.`,
				cause,
			}),
	});
	return {
		projectId: record.projectId,
		title: manifest.title,
		...(manifest.game === undefined
			? {}
			: {
					game: manifest.game,
				}),
		createdAtMs: manifest.createdAtMs,
		updatedAtMs: manifest.updatedAtMs,
		revision,
		config: compilation.payload.config,
		resources: compilation.payload.resources,
		resourceSourcePaths: compilation.resourcePaths,
		diagnostics: compilation.diagnostics,
	} satisfies EditorProject;
});
