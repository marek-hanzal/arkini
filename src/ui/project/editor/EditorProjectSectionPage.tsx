import { EditorProjectAppearanceSection } from "~/ui/project/editor/EditorProjectAppearanceSection";
import { EditorProjectBoardSection } from "~/ui/project/editor/EditorProjectBoardSection";
import { EditorProjectGeneralSection } from "~/ui/project/editor/EditorProjectGeneralSection";
import { EditorProjectInventorySection } from "~/ui/project/editor/EditorProjectInventorySection";
import type { EditorProjectSectionId } from "~/ui/project/editor/EditorProjectSections";
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
}) => renderSection(section);
