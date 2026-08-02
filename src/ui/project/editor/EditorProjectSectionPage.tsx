import { EditorSectionNavigation } from "~/ui/editor/EditorSectionNavigation";
import { EditorSectionPage } from "~/ui/editor/EditorSectionPage";
import { EditorSectionTabs } from "~/ui/editor/EditorSectionTabs";
import { EditorFormContent } from "~/ui/form/EditorFormContent";
import { EditorFormSaveButton } from "~/ui/form/EditorFormSaveButton";
import { EditorProjectAppearanceSection } from "~/ui/project/editor/EditorProjectAppearanceSection";
import { useEditorProjectFormSession } from "~/ui/project/editor/EditorProjectFormContext";
import { EditorProjectGeneralSection } from "~/ui/project/editor/EditorProjectGeneralSection";
import { EditorProjectSectionLink } from "~/ui/project/editor/EditorProjectSectionLink";
import {
	EditorProjectSections,
	type EditorProjectSectionId,
} from "~/ui/project/editor/EditorProjectSections";
import { EditorProjectSurfacesSection } from "~/ui/project/editor/EditorProjectSurfacesSection";

const renderSection = (section: EditorProjectSectionId) => {
	switch (section) {
		case "general":
			return <EditorProjectGeneralSection />;
		case "appearance":
			return <EditorProjectAppearanceSection />;
		case "surfaces":
			return <EditorProjectSurfacesSection />;
	}
};

/** Renders one explicit Project section from the shared parent form session. */
export const EditorProjectSectionPage = ({
	section,
}: {
	readonly section: EditorProjectSectionId;
}) => {
	const controller = useEditorProjectFormSession();
	return (
		<EditorSectionPage
			tabs={
				<EditorSectionNavigation
					title={<h1 className="truncate text-xl font-semibold">Project</h1>}
					tabs={
						<EditorSectionTabs label="Project sections">
							{EditorProjectSections.map((candidate) => (
								<EditorProjectSectionLink
									key={candidate.id}
									projectId={controller.project.projectId}
									section={candidate}
								/>
							))}
						</EditorSectionTabs>
					}
					action={
						<EditorFormSaveButton
							dirty={controller.isDirty}
							saving={controller.isSaving}
							save={controller.save}
						/>
					}
				/>
			}
		>
			<div className="grid gap-[var(--ak-viewport-gap)]">
				<EditorFormContent
					error={controller.error}
					save={controller.save}
				>
					{renderSection(section)}
				</EditorFormContent>
			</div>
		</EditorSectionPage>
	);
};
