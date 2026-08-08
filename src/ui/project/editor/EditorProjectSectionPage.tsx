import { EditorProjectAppearanceSection } from "~/ui/project/editor/EditorProjectAppearanceSection";
import { EditorProjectGeneralSection } from "~/ui/project/editor/EditorProjectGeneralSection";
import type { EditorProjectSectionId } from "~/ui/project/editor/EditorProjectSections";
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
}) => renderSection(section);
