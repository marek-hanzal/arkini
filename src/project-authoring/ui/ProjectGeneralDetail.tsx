import type { ReactNode } from "react";

import { EditorRootCard } from "~/authoring-shell/ui/EditorRootCard";
import { DetailFact, DetailFacts, DetailSection } from "~/item-authoring/ui/DetailDefinition";
import type { Project } from "~/project-authoring/type/Project";
import type { ProjectSectionId } from "~/project-authoring/type/ProjectSections";
import { ProjectOverview } from "~/project-authoring/ui/ProjectOverview";
import { LinkButton, LinkButtonLink } from "~/ui/ui/LinkButton";
import { ProjectIdentityRenameDialog } from "~/project-authoring/ui/ProjectIdentityRenameDialog";
import { useProjectIdentityRenameController } from "~/project-authoring/ui/useProjectIdentityRenameController";

const ProjectSectionValueLink = ({
	children,
	projectId,
	sectionId,
}: {
	readonly children: ReactNode;
	readonly projectId: string;
	readonly sectionId: ProjectSectionId;
}) => (
	<LinkButtonLink
		params={{
			projectId,
			sectionId,
		}}
		to="/editor/$projectId/project/detail/$sectionId"
	>
		{children}
	</LinkButtonLink>
);

export const ProjectGeneralDetail = ({ project }: { readonly project: Project }) => {
	const { board, inventory, toolbarSize = 0 } = project.config.meta;
	const identityRename = useProjectIdentityRenameController({
		project,
	});
	return (
		<>
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
								value={
									<span className="flex min-w-0 flex-wrap items-center gap-2">
										<code className="break-all">{project.projectId}</code>
										<LinkButton onClick={identityRename.openFn}>
											Rename
										</LinkButton>
									</span>
								}
							/>
							<div className="grid min-w-0 gap-3">
								<DetailFact
									label="Board"
									value={
										<ProjectSectionValueLink
											projectId={project.projectId}
											sectionId="board"
										>
											{board.width} × {board.height} ={" "}
											{board.width * board.height}
										</ProjectSectionValueLink>
									}
								/>
								<DetailFact
									label="Inventory"
									value={
										<ProjectSectionValueLink
											projectId={project.projectId}
											sectionId="inventory"
										>
											{inventory.width} × {inventory.height} ={" "}
											{inventory.width * inventory.height}
										</ProjectSectionValueLink>
									}
								/>
								<DetailFact
									label="Toolbar"
									value={
										<ProjectSectionValueLink
											projectId={project.projectId}
											sectionId="toolbar"
										>
											{toolbarSize}
										</ProjectSectionValueLink>
									}
								/>
							</div>
						</DetailFacts>
					</DetailSection>
				</EditorRootCard>
				<ProjectOverview project={project} />
			</div>
			{identityRename.confirming ? (
				<ProjectIdentityRenameDialog
					controller={identityRename}
					project={project}
				/>
			) : null}
		</>
	);
};
