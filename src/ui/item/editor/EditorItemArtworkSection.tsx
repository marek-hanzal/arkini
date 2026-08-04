import { EditorFormCard } from "~/ui/form/EditorFormCard";
import { EditorItemArtworkFields } from "~/ui/item/editor/EditorItemArtworkFields";
import { EditorItemArtworkPreview } from "~/ui/item/editor/EditorItemArtworkPreview";
import { useEditorItemFormSession } from "~/ui/item/editor/EditorItemFormContext";

export const EditorItemArtworkSection = () => {
	const { form } = useEditorItemFormSession();
	return (
		<div className="grid gap-[var(--ak-viewport-gap)]">
			<EditorFormCard>
				<EditorItemArtworkFields
					form={form}
					fields="asset"
				/>
			</EditorFormCard>
			<form.Subscribe selector={(state) => state.values.asset}>
				{(asset) => <EditorItemArtworkPreview asset={asset} />}
			</form.Subscribe>
		</div>
	);
};
