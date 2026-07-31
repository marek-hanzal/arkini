import { EditorSearchCombobox } from "~/ui/form/EditorSearchCombobox";
import { EditorItemThumbnail } from "~/ui/item/editor/EditorItemThumbnail";
import { useEditorItemSearchOptions } from "~/ui/item/editor/useEditorItemSearchOptions";

export interface EditorItemReferenceControlProps {
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
			renderPreview={(option) => {
				const item = items?.[option.id];
				return item === undefined ? null : (
					<EditorItemThumbnail resourceIds={item.asset.default} />
				);
			}}
		/>
	);
};
