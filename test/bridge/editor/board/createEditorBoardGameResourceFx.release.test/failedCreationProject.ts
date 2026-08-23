import type { EditorProject } from "~/bridge/editor/EditorProject";
import { editorTestPayload } from "~test/editor/support/editorTestPayload";

export const failedCreationProject: EditorProject = {
	projectId: "failed-editor-board",
	title: editorTestPayload.config.meta.title,
	version: editorTestPayload.version,
	createdAtMs: 1,
	updatedAtMs: 1,
	revision: 1,
	config: editorTestPayload.config,
	resources: editorTestPayload.resources,
};
