import type { Project } from "~/project-authoring/type/Project";
import {
	editorTestResources,
	editorTestPayload,
} from "~test/project-authoring/support/editorTestPayload";

/** Small project used to isolate failed Board game creation and release. */
export const failedCreationProject: Project = {
	projectId: "failed-editor-board",
	title: editorTestPayload.config.meta.title,
	version: {
		major: 1,
		minor: 0,
	},
	createdAtMs: 1,
	updatedAtMs: 1,
	revision: 1,
	config: editorTestPayload.config,
	resources: editorTestResources,
};
