import { EditorSearchCombobox } from "~/ui/form/EditorSearchCombobox";
import { EditorItemSearchThumbnail } from "~/ui/item/EditorItemThumbnail";
import { useEditorItemSearchOptions } from "~/ui/item/useEditorItemSearchOptions";

interface EditorItemReferenceControlProps {
	readonly label: string;
	readonly onChange: (itemId: string) => void;
	readonly value: string;
}

/** Reuses the canonical item autocomplete outside direct TanStack field bindings. */
export const EditorItemReferenceControl = ({
	label,
	onChange,
	value,
}: EditorItemReferenceControlProps) => {
	const { items, options } = useEditorItemSearchOptions();
	return (
		<EditorSearchCombobox
			label={label}
			emptyLabel="No known item matches this search."
			options={options}
			value={value}
			onChange={onChange}
			renderPreview={(option) => <EditorItemSearchThumbnail item={items?.[option.id]} />}
			renderSelectedPreview={(option) => (
				<EditorItemSearchThumbnail
					item={items?.[option.id]}
					selected
				/>
			)}
		/>
	);
};
