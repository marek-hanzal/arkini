import { useTranslator } from "~/translation/ui/useTranslator";
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
	const translator = useTranslator();
	const { board } = project.config.meta;
	const identityRename = useProjectIdentityRenameController({
		project,
	});
	return (
		<>
			<div className="grid gap-[var(--ak-viewport-gap)]">
				<EditorRootCard dataUi="EditorProjectGeneralDetailCard">
					<DetailSection title={translator.textFn("General")}>
						<DetailFacts columns={3}>
							<DetailFact
								label={translator.textFn("Title")}
								value={project.config.meta.title}
							/>
							<DetailFact
								label={translator.textFn("Project ID")}
								value={
									<span className="flex min-w-0 flex-wrap items-center gap-2">
										<code className="break-all">{project.projectId}</code>
										<LinkButton onClick={identityRename.openFn}>
											{translator.textFn("Rename")}
										</LinkButton>
									</span>
								}
							/>
							<div className="hidden min-[48rem]:block" />
							<DetailFact
								label={translator.textFn("Board")}
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
