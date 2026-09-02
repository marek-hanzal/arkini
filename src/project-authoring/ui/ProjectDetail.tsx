import { Pencil } from "lucide-react";
import type { PropsWithChildren } from "react";

import { useEditorProject } from "~/authoring-session/ui/useEditorProject";
import { EditorHistoryBackButton } from "~/authoring-shell/ui/EditorHistoryBackButton";
import { EditorSectionNavigation } from "~/authoring-shell/ui/EditorSectionNavigation";
import { EditorSectionPage } from "~/authoring-shell/ui/EditorSectionPage";
import { EditorSectionTabs } from "~/authoring-shell/ui/EditorSectionTabs";
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
			tabs={
				<EditorSectionNavigation
					action={
						<div className="flex items-center gap-4">
							<ProjectSourceExport projectId={project.projectId} />
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
								Edit
							</PrimaryButtonLink>
						</div>
					}
					leading={
						<EditorHistoryBackButton
							params={{
								projectId: project.projectId,
							}}
							to="/editor/$projectId/editor/items/list"
						/>
					}
					tabs={
						<EditorSectionTabs>
							{ProjectSections.map((section) => (
								<ProjectSectionLink
									destination="detail"
									key={section.id}
									projectId={project.projectId}
									section={section}
								/>
							))}
						</EditorSectionTabs>
					}
					title={
						<h1 className="truncate text-xl font-semibold">
							{project.config.meta.title}
						</h1>
					}
				/>
			}
		>
			{children}
		</EditorSectionPage>
	);
};
