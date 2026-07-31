import { EditorCreateItemForm } from "~/ui/item/editor/EditorCreateItemForm";

export const EditorItemCreatePage = ({
	itemType,
	uid,
}: EditorCreateItemForm.Props) => (
	<EditorCreateItemForm
		itemType={itemType}
		uid={uid}
	/>
);
