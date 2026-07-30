import { Effect } from "effect";
import { EditorProjectRecordSchema } from "../../../electron/contract/editor/EditorProjectRecord";

import type { EditorProject } from "~/bridge/editor/EditorProject";
import type { EditorWorkspace } from "~/bridge/editor/EditorWorkspace";
import { createEditorWorkspaceFx } from "~/bridge/editor/createEditorWorkspaceFx";
import { EditorProjectError } from "~/engine/editor/error/EditorProjectError";
import { compileEditorProjectFilesFx } from "~/engine/editor/fx/compileEditorProjectFilesFx";
import { EditorSourceFileSchema } from "~/engine/editor/schema/EditorSourceFileSchema";

export namespace readEditorProjectFx {
	export interface Props {
		readonly projectId: string;
		readonly workspace?: EditorWorkspace;
	}
}

/** Reads and recompiles one project through the same source contracts used by CLI packing. */
export const readEditorProjectFx = Effect.fn("readEditorProjectFx")(function* ({
	projectId,
	workspace: providedWorkspace,
}: readEditorProjectFx.Props) {
	const workspace = providedWorkspace ?? (yield* createEditorWorkspaceFx());
	const record = yield* workspace.readFx(projectId);
	if (record === null) {
		return yield* Effect.fail(
			new EditorProjectError({
				reason: "project-not-found",
				message: `Editor project ${projectId} does not exist.`,
			}),
		);
	}
	const parsedRecord = yield* Effect.try({
		try: () => EditorProjectRecordSchema.parse(record),
		catch: (cause) =>
			new EditorProjectError({
				reason: "unsupported-project-file",
				message: `Editor project ${projectId} returned an invalid workspace record.`,
				cause,
			}),
	});
	if (parsedRecord.projectId !== projectId) {
		return yield* Effect.fail(
			new EditorProjectError({
				reason: "unsupported-project-file",
				message: `Editor project ${projectId} returned workspace ${parsedRecord.projectId}.`,
			}),
		);
	}
	const files = yield* Effect.try({
		try: () => EditorSourceFileSchema.array().parse(parsedRecord.files),
		catch: (cause) =>
			new EditorProjectError({
				reason: "unsupported-project-file",
				message: `Editor project ${projectId} contains an invalid file record.`,
				cause,
			}),
	});
	const compilation = yield* compileEditorProjectFilesFx(files);
	return {
		projectId,
		config: compilation.payload.config,
		resources: compilation.payload.resources,
		diagnostics: compilation.diagnostics,
	} satisfies EditorProject;
});
