import type { Project } from "~/project-authoring/type/Project";
import {
	editorTestResources,
	editorTestPayload,
} from "~test/project-authoring/support/editorTestPayload";

export const boardSpaceProject = {
	projectId: "project",
	title: editorTestPayload.config.meta.title,
	version: {
		major: 1,
		minor: 0,
	},
	createdAtMs: 1,
	updatedAtMs: 2,
	revision: 0,
	config: {
		...editorTestPayload.config,
		templates: [
			{
				uid: "first",
				title: "First",
				width: 3,
				height: 3,
				board: [
					{
						itemUid: "water",
						x: 0,
						y: 0,
					},
				],
			},
			{
				uid: "second",
				title: "Second",
				width: 4,
				height: 2,
				board: [
					{
						itemUid: "water",
						x: 1,
						y: 1,
					},
				],
			},
		],
		start: {
			currentSpace: 0,
			spaces: [
				{
					space: 0,
					templateUid: "first",
				},
				{
					space: 1,
					templateUid: "second",
				},
			],
		},
	},
	resources: editorTestResources,
} satisfies Project;
