import { EditorSectionPage } from "~/ui/editor/EditorSectionPage";
import { EditorSectionTabs } from "~/ui/editor/EditorSectionTabs";
import { EditorProjectAppearanceSection } from "~/ui/project/editor/EditorProjectAppearanceSection";
import { EditorProjectBoardSection } from "~/ui/project/editor/EditorProjectBoardSection";
import { useEditorProjectFormSession } from "~/ui/project/editor/EditorProjectFormContext";
import { EditorProjectGeneralSection } from "~/ui/project/editor/EditorProjectGeneralSection";
import { EditorProjectInventorySection } from "~/ui/project/editor/EditorProjectInventorySection";
import { EditorProjectSectionLink } from "~/ui/project/editor/EditorProjectSectionLink";
import {
	EditorProjectSections,
	type EditorProjectSectionId,
} from "~/ui/project/editor/EditorProjectSections";
import { EditorProjectToolbarSection } from "~/ui/project/editor/EditorProjectToolbarSection";

const renderSection = (section: EditorProjectSectionId) => {
	switch (section) {
		case "general":
			return <EditorProjectGeneralSection />;
		case "appearance":
			return <EditorProjectAppearanceSection />;
		case "board":
			return <EditorProjectBoardSection />;
		case "toolbar":
			return <EditorProjectToolbarSection />;
		case "inventory":
			return <EditorProjectInventorySection />;
	}
};

/** Renders one explicit Project section from the shared parent form session. */
export const EditorProjectSectionPage = ({
	section,
}: {
	readonly section: EditorProjectSectionId;
}) => {
	const { project } = useEditorProjectFormSession();
	return (
		<EditorSectionPage
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
			{renderSection(section)}
		</EditorSectionPage>
	);
};
