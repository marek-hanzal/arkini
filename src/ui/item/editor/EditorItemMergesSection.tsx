import { useEditorItemFormSession } from "~/ui/item/editor/EditorItemFormContext";
import { EditorMergeFields } from "~/ui/item/editor/EditorMergeFields";

export const EditorItemMergesSection = () => {
	const { form } = useEditorItemFormSession();
	return (
		<form.Subscribe selector={(state) => state.values.merge}>
			{(merge) => (
				<EditorMergeFields
					value={merge}
					onChange={(next) => form.setFieldValue("merge", next)}
				/>
			)}
		</form.Subscribe>
	);
};
