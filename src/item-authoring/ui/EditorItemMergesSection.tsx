import { useEditorItemFormSession } from "~/item-authoring/ui/EditorItemFormContext";
import { EditorMergeFields } from "~/item-authoring/ui/EditorMergeFields";

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
