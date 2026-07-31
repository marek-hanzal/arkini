import { EditorEditItemForm } from "~/ui/item/editor/EditorEditItemForm";

export const EditorItemEditPage = ({ uid }: { readonly uid: string }) => (
	<EditorEditItemForm uid={uid} />
);
