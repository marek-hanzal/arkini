import { EditorRootCard } from "~/authoring-shell/ui/EditorRootCard";
import { DetailFact, DetailFacts, DetailSection } from "~/item-authoring/ui/DetailDefinition";
import type { Project } from "~/project-authoring/type/Project";
import { ProjectOverview } from "~/project-authoring/ui/ProjectOverview";

export const ProjectGeneralDetail = ({ project }: { readonly project: Project }) => {
	const { board, inventory, toolbarSize = 0 } = project.config.meta;
	return (
		<div className="grid gap-6">
			<EditorRootCard dataUi="EditorProjectGeneralDetailCard">
				<DetailSection title="General">
					<DetailFacts columns={3}>
						<DetailFact
							label="Title"
							value={project.config.meta.title}
						/>
						<DetailFact
							label="Project ID"
							mono
							value={project.projectId}
						/>
						<div className="grid min-w-0 gap-3">
							<DetailFact
								label="Board"
								value={`${board.width} × ${board.height} = ${board.width * board.height}`}
							/>
							<DetailFact
								label="Inventory"
								value={`${inventory.width} × ${inventory.height} = ${inventory.width * inventory.height}`}
							/>
							<DetailFact
								label="Toolbar"
								value={toolbarSize}
							/>
						</div>
					</DetailFacts>
				</DetailSection>
			</EditorRootCard>
			<ProjectOverview project={project} />
		</div>
	);
};
