import { EditorRootCard } from "~/authoring-shell/ui/EditorRootCard";
import { DetailFact, DetailFacts, DetailSection } from "~/item-authoring/ui/DetailDefinition";
import type { Project } from "~/project-authoring/type/Project";
import { ProjectStartGridDetail } from "~/project-authoring/ui/ProjectStartGridDetail";

export const ProjectInventoryDetail = ({ project }: { readonly project: Project }) => {
	const { inventory } = project.config.meta;
	return (
		<div className="grid gap-6">
			<EditorRootCard dataUi="EditorProjectInventorySizeDetailCard">
				<DetailSection title="Inventory size">
					<DetailFacts>
						<DetailFact
							label="Width"
							value={inventory.width}
						/>
						<DetailFact
							label="Height"
							value={inventory.height}
						/>
					</DetailFacts>
				</DetailSection>
			</EditorRootCard>
			<EditorRootCard dataUi="EditorProjectInventoryPreviewDetailCard">
				<DetailSection title="Initial inventory">
					<ProjectStartGridDetail
						cells={project.config.start.inventory.map((entry) => ({
							itemId: entry.itemId,
							quantity: entry.quantity ?? 1,
							x: entry.position.x,
							y: entry.position.y,
						}))}
						height={inventory.height}
						items={project.config.items}
						width={inventory.width}
					/>
				</DetailSection>
			</EditorRootCard>
		</div>
	);
};
