import type { EditorProjectSectionId } from "~/ui/project/editor/EditorProjectSections";
import { EditorProjectSectionPage } from "~/ui/project/editor/EditorProjectSectionPage";

export const EditorProjectSectionRoutePage = ({
	section,
}: {
	readonly section: EditorProjectSectionId;
}) => <EditorProjectSectionPage section={section} />;
