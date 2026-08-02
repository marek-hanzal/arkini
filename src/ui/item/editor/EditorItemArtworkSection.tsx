import { EditorItemArtworkFields } from "~/ui/item/editor/EditorItemArtworkFields";
import { useEditorItemFormSession } from "~/ui/item/editor/EditorItemFormContext";

export const EditorItemArtworkSection = () => {
	const { form } = useEditorItemFormSession();
	return (
		<div className="grid gap-4">
			<EditorItemArtworkFields
				form={form}
				fields="asset"
			/>
		</div>
	);
};
