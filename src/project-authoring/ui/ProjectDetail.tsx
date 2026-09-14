import { Pencil } from "lucide-react";
import type { PropsWithChildren } from "react";

import { useEditorProject } from "~/authoring-session/ui/useEditorProject";
import { EditorHistoryBackButton } from "~/authoring-shell/ui/EditorHistoryBackButton";
import { EditorPageHelp } from "~/authoring-shell/ui/EditorPageHelp";
import { ProjectSectionHelp } from "~/project-authoring/ui/ProjectSectionHelp";
import { Tx } from "~/translation/ui/Tx";
import { EditorSectionNavigation } from "~/authoring-shell/ui/EditorSectionNavigation";
import { EditorSectionPage } from "~/authoring-shell/ui/EditorSectionPage";
import { EditorSectionBar } from "~/authoring-shell/ui/EditorSectionBar";
import { useEditorEditShortcut } from "~/authoring-shell/ui/useEditorEditShortcut";
import { ProjectSectionLink } from "~/project-authoring/ui/ProjectSectionLink";
import { ProjectSourceExport } from "~/project-authoring/ui/ProjectSourceExport";
import { ProjectSections, type ProjectSectionId } from "~/project-authoring/type/ProjectSections";
import { PrimaryButtonLink } from "~/ui/ui/Button";

export const ProjectDetail = ({
	children,
	sectionId,
}: PropsWithChildren<{
	readonly sectionId: ProjectSectionId;
}>) => {
	const project = useEditorProject();
	const editActionRef = useEditorEditShortcut();
	return (
		<EditorSectionPage
			contentClassName="mx-auto w-3/4"
			header={
				<EditorSectionNavigation
					action={
						<PrimaryButtonLink
							ref={editActionRef}
							className="h-10 min-h-10 gap-2 px-3 py-2 text-sm"
							to="/editor/$projectId/project/form/$sectionId"
							params={{
								projectId: project.projectId,
								sectionId,
							}}
						>
							<Pencil className="size-4" />
							<Tx label="Edit" />
						</PrimaryButtonLink>
					}
					leading={
						<EditorHistoryBackButton
							params={{
								projectId: project.projectId,
							}}
							to="/editor/$projectId/editor/items/list"
						/>
					}
					title={
						<h1 className="truncate text-xl font-semibold">
							{project.config.meta.title}
						</h1>
					}
				/>
			}
			secondaryNavigation={
				<EditorSectionBar
					actions={<ProjectSourceExport projectId={project.projectId} />}
					help={<EditorPageHelp {...ProjectSectionHelp[sectionId]} />}
				>
					{ProjectSections.map((section) => (
						<ProjectSectionLink
							destination="detail"
							key={section.id}
							projectId={project.projectId}
							section={section}
						/>
					))}
				</EditorSectionBar>
			}
		>
			{children}
		</EditorSectionPage>
	);
};
