import { EditorRootCard } from "~/authoring-shell/ui/EditorRootCard";
import { DetailFact, DetailFacts, DetailSection } from "~/item-authoring/ui/DetailDefinition";
import type { Project } from "~/project-authoring/type/Project";
import { ProjectStartGrid } from "~/project-authoring/ui/ProjectStartGrid";

export const ProjectInventoryDetail = ({ project }: { readonly project: Project }) => {
	const { inventory } = project.config.meta;
	return (
		<div className="grid gap-6">
			<EditorRootCard dataUi="EditorProjectInventorySizeDetailCard">
				<DetailSection title="Inventory size">
					<DetailFacts columns={3}>
						<DetailFact
							label="Width"
							value={inventory.width}
						/>
						<DetailFact
							label="Height"
							value={inventory.height}
						/>
						<DetailFact
							label="Capacity"
							value={inventory.width * inventory.height}
						/>
					</DetailFacts>
				</DetailSection>
			</EditorRootCard>
			<EditorRootCard dataUi="EditorProjectInventoryPreviewDetailCard">
				<DetailSection title="Initial inventory">
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
						projectId={project.projectId}
						width={inventory.width}
					/>
				</DetailSection>
			</EditorRootCard>
		</div>
	);
};
