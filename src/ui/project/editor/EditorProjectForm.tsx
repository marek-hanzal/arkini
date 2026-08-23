import { useNavigate } from "@tanstack/react-router";
import { useCallback, type PropsWithChildren } from "react";

import { useEditorProject } from "~/bridge/editor/useEditorProject";
import { EditorSectionTabs } from "~/ui/editor/EditorSectionTabs";
import { EditorFormSectionPage } from "~/ui/form/EditorFormSectionPage";
import { EditorProjectFormProvider } from "~/ui/project/editor/EditorProjectFormContext";
import { EditorProjectSectionLink } from "~/ui/project/editor/EditorProjectSectionLink";
import {
	EditorProjectSections,
	type EditorProjectSectionId,
} from "~/ui/project/editor/EditorProjectSections";
import { useEditorProjectFormController } from "~/ui/project/editor/useEditorProjectFormController";
import { EditorCompatibilityNotice } from "~/ui/editor/EditorCompatibilityNotice";

export const EditorProjectForm = ({ children }: PropsWithChildren) => {
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
					{children}
				</EditorFormSectionPage>
			</section>
		</EditorProjectFormProvider>
	);
};
