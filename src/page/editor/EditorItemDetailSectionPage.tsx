import type { EditorItemSectionId } from "~/ui/item/editor/EditorItemSections";
import { EditorItemDetailSectionPage as EditorItemDetailSection } from "~/ui/item/editor/EditorItemDetailSectionPage";

export const EditorItemDetailSectionPage = ({
	sectionId,
	uid,
}: {
	readonly sectionId: EditorItemSectionId;
	readonly uid: string;
}) => (
	<EditorItemDetailSection
		sectionId={sectionId}
		uid={uid}
	/>
);
