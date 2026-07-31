import type { EditorItemType } from "~/bridge/editor/EditorItemModel";
import { EditorCreateItemForm } from "~/ui/item/editor/EditorCreateItemForm";

export const EditorItemCreatePage = ({
	itemType,
	uid,
}: {
	readonly itemType: EditorItemType;
	readonly uid: string;
}) => (
	<EditorCreateItemForm
		itemType={itemType}
		uid={uid}
	/>
);
