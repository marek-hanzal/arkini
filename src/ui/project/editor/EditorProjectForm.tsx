import { useNavigate } from "@tanstack/react-router";
import { useCallback, type PropsWithChildren } from "react";

import { useEditorProject } from "~/bridge/editor/useEditorProject";
import { EditorFormContent } from "~/ui/form/EditorFormContent";
import { EditorFormSaveButton } from "~/ui/form/EditorFormSaveButton";
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
				className="flex h-full min-h-0 flex-col gap-[var(--ak-viewport-gap)]"
				data-ui="EditorProjectForm"
			>
				<header className="flex min-w-0 items-center gap-3">
					<h1 className="min-w-0 flex-1 truncate text-xl font-semibold">Project</h1>
					<EditorFormSaveButton
						dirty={controller.isDirty}
						saving={controller.isSaving}
						save={controller.save}
					/>
				</header>
				<EditorFormContent
					error={controller.error}
					save={controller.save}
				>
					{children}
				</EditorFormContent>
			</section>
		</EditorProjectFormProvider>
	);
};
