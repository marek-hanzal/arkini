import { Effect } from "effect";

import type { EditorWorkspace } from "~/bridge/editor/EditorWorkspace";
import { createEditorProjectFromRecordFx } from "~/bridge/editor/createEditorProjectFromRecordFx";
import { createEditorWorkspaceFx } from "~/bridge/editor/createEditorWorkspaceFx";
import { EditorProjectError } from "~/engine/editor/error/EditorProjectError";

export namespace readEditorProjectFx {
	export interface Props {
		readonly projectId: string;
		readonly workspace?: EditorWorkspace;
	}
}

/** Reads one manifest-backed project and compiles game sources when they exist. */
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
	if (record.projectId !== projectId) {
		return yield* Effect.fail(
			new EditorProjectError({
				reason: "unsupported-project-file",
				message: `Editor project ${projectId} returned workspace ${record.projectId}.`,
			}),
		);
	}
	return yield* createEditorProjectFromRecordFx(record);
});
