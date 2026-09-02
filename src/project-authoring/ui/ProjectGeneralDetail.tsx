import { EditorRootCard } from "~/authoring-shell/ui/EditorRootCard";
import { DetailFact, DetailFacts, DetailSection } from "~/item-authoring/ui/DetailDefinition";
import type { Project } from "~/project-authoring/type/Project";
import { ProjectOverview } from "~/project-authoring/ui/ProjectOverview";

export const ProjectGeneralDetail = ({ project }: { readonly project: Project }) => {
	return (
		<div className="grid gap-6">
			<EditorRootCard dataUi="EditorProjectGeneralDetailCard">
				<DetailSection title="General">
					<DetailFacts>
						<DetailFact
							label="Title"
							value={project.config.meta.title}
						/>
						<DetailFact
							label="Project ID"
							mono
							value={project.projectId}
						/>
					</DetailFacts>
				</DetailSection>
			</EditorRootCard>
			<ProjectOverview project={project} />
		</div>
	);
};
