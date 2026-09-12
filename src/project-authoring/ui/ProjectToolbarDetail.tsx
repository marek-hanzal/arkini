import { EditorRootCard } from "~/authoring-shell/ui/EditorRootCard";
import type { Project } from "~/project-authoring/type/Project";
import { ProjectStartGrid } from "~/project-authoring/ui/ProjectStartGrid";

export const ProjectToolbarDetail = ({ project }: { readonly project: Project }) => {
	const size = project.config.meta.toolbarSize ?? 0;
	return (
		<div className="grid gap-6">
			{size === 0 ? null : (
				<EditorRootCard dataUi="EditorProjectToolbarPreviewDetailCard">
					<ProjectStartGrid
						cells={project.config.start.toolbar.map((entry) => ({
							itemId: entry.itemId,
							quantity: entry.quantity ?? 1,
							x: entry.position.x,
							y: entry.position.y,
						}))}
						height={1}
						items={project.config.items}
						mode="detail"
						scope="toolbar"
						projectId={project.projectId}
						width={size}
					/>
				</EditorRootCard>
			)}
		</div>
	);
};
