import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useCallback } from "react";

import { useEditorProject } from "~/authoring-session/ui/useEditorProject";
import { EditorCompatibilityNotice } from "~/project-version/ui/EditorCompatibilityNotice";
import { EditorHistoryBackButton } from "~/authoring-shell/ui/EditorHistoryBackButton";
import { EditorSectionTabs } from "~/authoring-shell/ui/EditorSectionTabs";
import { EditorFormSectionPage } from "~/ui/form/EditorFormSectionPage";
import { EditorProjectFormProvider } from "~/project-authoring/ui/EditorProjectFormContext";
import { EditorProjectSectionLink } from "~/project-authoring/ui/EditorProjectSectionLink";
import {
	EditorProjectSections,
	type EditorProjectSectionId,
} from "~/project-authoring/type/EditorProjectSections";
import { useEditorProjectFormController } from "~/project-authoring/ui/useEditorProjectFormController";

export const Route = createFileRoute("/editor/$projectId/project")({
	component: () => {
		const navigate = useNavigate();
		const project = useEditorProject();
		const onInvalidSection = useCallback(
			(sectionId: EditorProjectSectionId) =>
				navigate({
					to: "/editor/$projectId/project/$sectionId",
					params: {
						projectId: project.projectId,
						sectionId,
					},
				}),
			[
				navigate,
				project.projectId,
			],
		);
		const controller = useEditorProjectFormController({
			onInvalidSection,
		});
		return (
			<EditorProjectFormProvider value={controller}>
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
							<EditorCompatibilityNotice
								compatibility={controller.compatibility}
								version={project.version}
							/>
						}
						save={controller.save}
						saving={controller.isSaving}
						tabs={
							<EditorSectionTabs label="Project sections">
								{EditorProjectSections.map((candidate) => (
									<EditorProjectSectionLink
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
			</EditorProjectFormProvider>
		);
	},
});
