import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useCallback } from "react";

import { useEditorProject } from "~/ui/editor/useEditorProject";
import { EditorCompatibilityNotice } from "~/ui/editor/EditorCompatibilityNotice";
import { EditorHistoryBackButton } from "~/ui/editor/EditorHistoryBackButton";
import { EditorSectionTabs } from "~/ui/editor/EditorSectionTabs";
import { EditorFormSectionPage } from "~/ui/form/EditorFormSectionPage";
import { EditorProjectFormProvider } from "~/ui/project/editor/EditorProjectFormContext";
import { EditorProjectSectionLink } from "~/ui/project/editor/EditorProjectSectionLink";
import {
	EditorProjectSections,
	type EditorProjectSectionId,
} from "~/ui/project/editor/EditorProjectSections";
import { useEditorProjectFormController } from "~/ui/project/editor/useEditorProjectFormController";

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
