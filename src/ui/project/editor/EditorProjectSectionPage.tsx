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
				<div className="grid gap-[var(--ak-viewport-gap)]">
					<header className="flex min-w-0 items-center gap-3">
						<h1 className="min-w-0 flex-1 truncate text-xl font-semibold">Project</h1>
						<EditorFormSaveButton
							dirty={controller.isDirty}
							saving={controller.isSaving}
							save={controller.save}
						/>
					</header>
					<EditorSectionTabs label="Project sections">
						{EditorProjectSections.map((candidate) => (
							<EditorProjectSectionLink
								key={candidate.id}
								projectId={controller.project.projectId}
								section={candidate}
							/>
						))}
					</EditorSectionTabs>
				</div>
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
