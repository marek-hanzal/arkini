import { EditorRootCard } from "~/authoring-shell/ui/EditorRootCard";
import { DetailFact, DetailFacts, DetailSection } from "~/item-authoring/ui/DetailDefinition";
import type { Project } from "~/project-authoring/type/Project";
import { ProjectStartGrid } from "~/project-authoring/ui/ProjectStartGrid";

export const ProjectToolbarDetail = ({ project }: { readonly project: Project }) => {
	const size = project.config.meta.toolbarSize ?? 0;
	return (
		<div className="grid gap-6">
			<EditorRootCard dataUi="EditorProjectToolbarSizeDetailCard">
				<DetailSection title="Toolbar size">
					<DetailFacts>
						<DetailFact
							label="Slots"
							value={size}
						/>
						<DetailFact
							label="Status"
							value={size === 0 ? "Disabled" : "Enabled"}
						/>
					</DetailFacts>
				</DetailSection>
			</EditorRootCard>
			{size === 0 ? null : (
				<EditorRootCard dataUi="EditorProjectToolbarPreviewDetailCard">
					<DetailSection title="Initial toolbar">
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
							projectId={project.projectId}
							width={size}
						/>
					</DetailSection>
				</EditorRootCard>
			)}
		</div>
	);
};
