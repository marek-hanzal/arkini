import { useNavigate } from "@tanstack/react-router";
import { useCallback, type PropsWithChildren } from "react";

import { useEditorProject } from "~/bridge/editor/useEditorProject";
import { EditorProjectFormProvider } from "~/ui/project/editor/EditorProjectFormContext";
import type { EditorProjectSectionId } from "~/ui/project/editor/EditorProjectSections";
import { useEditorProjectFormController } from "~/ui/project/editor/useEditorProjectFormController";

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
				{children}
			</section>
		</EditorProjectFormProvider>
	);
};
