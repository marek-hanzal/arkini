import type { EditorProjectSectionId } from "~/ui/project/editor/EditorProjectSections";
import { EditorProjectSectionPage } from "~/ui/project/editor/EditorProjectSectionPage";

export const EditorProjectSectionRoutePage = ({
	avatarIndex,
	section,
}: {
	readonly avatarIndex?: number;
	readonly section: EditorProjectSectionId;
}) => (
	<EditorProjectSectionPage
		avatarIndex={avatarIndex}
		section={section}
	/>
);
