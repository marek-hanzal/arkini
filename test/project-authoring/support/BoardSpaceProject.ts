import type { Project } from "~/project-authoring/type/Project";
import { editorTestPayload } from "~test/project-authoring/support/editorTestPayload";

export const boardSpaceProject = {
	projectId: "project",
	title: editorTestPayload.config.meta.title,
	version: editorTestPayload.version,
	createdAtMs: 1,
	updatedAtMs: 2,
	revision: 0,
	config: {
		...editorTestPayload.config,
		start: {
			...editorTestPayload.config.start,
			currentSpace: 0,
			board: [
				{
					itemId: "water",
					quantity: 1,
					space: 0,
					x: 0,
					y: 0,
				},
				{
					itemId: "water",
					quantity: 2,
					space: 1,
					x: 1,
					y: 1,
				},
			],
		},
	},
	resources: editorTestPayload.resources,
} satisfies Project;
