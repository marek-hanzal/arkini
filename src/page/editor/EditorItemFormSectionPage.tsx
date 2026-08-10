import type { EditorItemSectionId } from "~/ui/item/editor/EditorItemSections";
import { EditorItemSectionPage } from "~/ui/item/editor/EditorItemSectionPage";

export const EditorItemFormSectionPage = ({
	section,
}: {
	readonly section: EditorItemSectionId;
}) => <EditorItemSectionPage section={section} />;
