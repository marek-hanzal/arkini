import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useCallback } from "react";

import { useEditorProject } from "~/authoring-session/ui/useEditorProject";
import { ProjectCompatibilityNotice } from "~/project-version/ui/ProjectCompatibilityNotice";
import { EditorHistoryBackButton } from "~/authoring-shell/ui/EditorHistoryBackButton";
import { EditorSectionTabs } from "~/authoring-shell/ui/EditorSectionTabs";
import { EditorFormSectionPage } from "~/editor-control/ui/EditorFormSectionPage";
import { ProjectFormProvider } from "~/project-authoring/ui/ProjectFormContext";
import { ProjectSectionLink } from "~/project-authoring/ui/ProjectSectionLink";
import { ProjectSections, type ProjectSectionId } from "~/project-authoring/type/ProjectSections";
import { useProjectFormController } from "~/project-authoring/ui/useProjectFormController";

export const Route = createFileRoute("/editor/$projectId/project")({
	component: () => {
		const navigateFn = useNavigate();
		const project = useEditorProject();
		const onInvalidSectionFn = useCallback(
			(sectionId: ProjectSectionId) =>
				navigateFn({
					to: "/editor/$projectId/project/$sectionId",
					params: {
						projectId: project.projectId,
						sectionId,
					},
				}),
			[
				navigateFn,
				project.projectId,
			],
		);
		const controller = useProjectFormController({
			onInvalidSectionFn,
		});
		return (
			<ProjectFormProvider value={controller}>
				<section
					className="h-full min-h-0"
					data-ui="EditorProjectForm"
				>
					<EditorFormSectionPage
						dirty={controller.isDirty}
						error={controller.error}
						leading={
							<EditorHistoryBackButton
								params={{
									projectId: project.projectId,
								}}
								to="/editor/$projectId/editor/items/list"
							/>
						}
						notice={
							<ProjectCompatibilityNotice
								compatibility={controller.compatibility}
								version={project.version}
							/>
						}
						saveFn={controller.saveFn}
						saving={controller.isSaving}
						tabs={
							<EditorSectionTabs>
								{ProjectSections.map((candidate) => (
									<ProjectSectionLink
										key={candidate.id}
										projectId={project.projectId}
										section={candidate}
									/>
								))}
							</EditorSectionTabs>
						}
					>
						<Outlet />
					</EditorFormSectionPage>
				</section>
			</ProjectFormProvider>
		);
	},
});
