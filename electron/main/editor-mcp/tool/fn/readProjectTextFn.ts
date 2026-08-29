import type { EditorProject } from "~/editor/EditorProject";

/** Formats the project tool result for one canonical editor snapshot. */
export const readProjectTextFn = (project: EditorProject) => {
	const avatarResourceIds = Object.entries(project.config.resources)
		.filter(([role]) => role.startsWith("avatar-"))
		.map(([, resourceId]) => resourceId);
	return [
		`Title: ${project.title}`,
		`Project ID: ${project.projectId}`,
		`Game ID: ${project.config.meta.id}`,
		`Arkpack version: ${project.version}`,
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
};
