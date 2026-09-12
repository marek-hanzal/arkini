import { EditorRootCard } from "~/authoring-shell/ui/EditorRootCard";
import type { Project } from "~/project-authoring/type/Project";
import { ProjectStartGrid } from "~/project-authoring/ui/ProjectStartGrid";

export const ProjectInventoryDetail = ({ project }: { readonly project: Project }) => {
	const { inventory } = project.config.meta;
	return (
		<div className="grid gap-6">
			<EditorRootCard dataUi="EditorProjectInventoryPreviewDetailCard">
				<ProjectStartGrid
					cells={project.config.start.inventory.map((entry) => ({
						itemId: entry.itemId,
						quantity: entry.quantity ?? 1,
						x: entry.position.x,
						y: entry.position.y,
					}))}
					height={inventory.height}
					items={project.config.items}
					mode="detail"
					scope="inventory"
					projectId={project.projectId}
					width={inventory.width}
				/>
			</EditorRootCard>
		</div>
	);
};
