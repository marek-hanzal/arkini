import { Effect } from "effect";

import type { EditorProjectFile } from "../../../electron/contract/editor/EditorProjectFile";
import { EditorProjectManifestSchema } from "../../../electron/contract/editor/EditorProjectManifest";
import type { EditorProject } from "~/bridge/editor/EditorProject";
import { EditorProjectError } from "~/engine/editor/error/EditorProjectError";
import type { EditorProjectCompilationSchema } from "~/engine/editor/schema/EditorProjectCompilationSchema";

/** Joins one compiled candidate with its exact manifest and in-memory file index. */
export const createEditorProjectFromCompilationFx = Effect.fn(
	"createEditorProjectFromCompilationFx",
)(function* ({
	compilation,
	fileIndex,
	manifestFile,
	projectId,
	revision,
}: {
	readonly compilation: EditorProjectCompilationSchema.Type;
	readonly fileIndex: Readonly<Record<string, EditorProjectFile>>;
	readonly manifestFile: EditorProjectFile;
	readonly projectId: string;
	readonly revision: string;
}) {
	const manifest = yield* Effect.try({
		try: () =>
			EditorProjectManifestSchema.parse(
				JSON.parse(new TextDecoder().decode(manifestFile.bytes)) as unknown,
			),
		catch: (cause) =>
			new EditorProjectError({
				reason: "unsupported-project-file",
				message: `Editor project ${projectId} contains an invalid editor.json.`,
				cause,
			}),
	});
	if (manifest.projectId !== projectId) {
		return yield* Effect.fail(
			new EditorProjectError({
				reason: "unsupported-project-file",
				message: `Editor project ${projectId} contains manifest ${manifest.projectId}.`,
			}),
		);
	}
	return {
		projectId,
		title: manifest.title,
		...(manifest.game === undefined
			? {}
			: {
					game: manifest.game,
				}),
		createdAtMs: manifest.createdAtMs,
		updatedAtMs: manifest.updatedAtMs,
		revision,
		fileIndex,
		itemSourcePaths: compilation.provenance.items,
		config: compilation.payload.config,
		resources: compilation.payload.resources,
		resourceSourcePaths: compilation.resourcePaths,
		diagnostics: compilation.diagnostics,
	} satisfies EditorProject;
});
