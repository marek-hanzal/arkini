import { EditorCreateItemForm } from "~/ui/item/editor/EditorCreateItemForm";

export const EditorItemCreatePage = ({ children, itemType, uid }: EditorCreateItemForm.Props) => (
	<EditorCreateItemForm
		itemType={itemType}
		uid={uid}
	>
		{children}
	</EditorCreateItemForm>
);
