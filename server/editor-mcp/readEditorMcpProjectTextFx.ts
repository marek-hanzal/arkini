import { Effect } from "effect";

import type { EditorProject } from "../../src/editor/EditorProject";

/** Formats the project tool result for one canonical editor snapshot. */
export const readEditorMcpProjectTextFx = Effect.fn("readEditorMcpProjectTextFx")(
	(project: EditorProject) =>
		Effect.sync(() => {
			const avatarResourceIds = Object.entries(project.config.resources)
				.filter(([role]) => role.startsWith("avatar-"))
				.map(([, resourceId]) => resourceId);
			return [
				`Title: ${project.title}`,
				`Project ID: ${project.projectId}`,
				`Game ID: ${project.config.meta.id}`,
				`Config version: ${project.game}`,
				`Revision: ${project.revision}`,
				`Board: ${project.config.meta.board.width} × ${project.config.meta.board.height}`,
				`Toolbar: ${project.config.meta.toolbarSize === undefined || project.config.meta.toolbarSize === 0 ? "disabled" : `${project.config.meta.toolbarSize} slots`}`,
				`Inventory: ${project.config.meta.inventory.width} × ${project.config.meta.inventory.height}`,
				`Hero asset: ${project.config.resources.hero}`,
				...(avatarResourceIds.length === 0
					? []
					: [
							`About avatars: ${avatarResourceIds.join(", ")}`,
						]),
				`Items: ${Object.keys(project.config.items).length}`,
				`Resources: ${project.resources.length}`,
			].join("\n");
		}),
);
