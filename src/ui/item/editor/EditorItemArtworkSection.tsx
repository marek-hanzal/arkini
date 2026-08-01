import { EditorFormSection } from "~/ui/form/EditorFormSection";
import { EditorItemArtworkFields } from "~/ui/item/editor/EditorItemArtworkFields";
import { useEditorItemFormSession } from "~/ui/item/editor/EditorItemFormContext";

export const EditorItemArtworkSection = () => {
	const { form } = useEditorItemFormSession();
	return (
		<EditorFormSection
			title="Artwork"
			description="The default composition supports one or two layered PNG assets."
		>
			<EditorItemArtworkFields
				form={form}
				fields="asset"
			/>
		</EditorFormSection>
	);
};
