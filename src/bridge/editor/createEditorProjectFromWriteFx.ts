import { Effect } from "effect";

import type { EditorProjectWriteResult } from "../../../electron/contract/editor/EditorProjectWriteResult";
import type { EditorProject } from "~/bridge/editor/EditorProject";
import { createEditorProjectFromCompilationFx } from "~/bridge/editor/createEditorProjectFromCompilationFx";
import type { EditorProjectCompilationSchema } from "~/engine/editor/schema/EditorProjectCompilationSchema";

/** Applies one persisted writer delta to the canonical in-memory project index. */
export const createEditorProjectFromWriteFx = Effect.fn("createEditorProjectFromWriteFx")(
	({
		compilation,
		project,
		write,
	}: {
		readonly compilation: EditorProjectCompilationSchema.Type;
		readonly project: EditorProject;
		readonly write: EditorProjectWriteResult;
	}) => {
		const fileIndex = {
			...project.fileIndex,
			[write.file.path]: write.file,
			[write.manifest.path]: write.manifest,
		};
		return createEditorProjectFromCompilationFx({
			compilation,
			fileIndex,
			manifestFile: write.manifest,
			projectId: project.projectId,
			revision: write.revision,
		});
	},
);
