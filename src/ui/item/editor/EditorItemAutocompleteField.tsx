import { RendererRuntime } from "~/bridge/runtime/RendererRuntime";
import { useFieldContext } from "~/ui/form/EditorFormContexts";
import { readEditorFieldErrorFx } from "~/ui/form/readEditorFieldErrorFx";
import { EditorSearchCombobox } from "~/ui/form/EditorSearchCombobox";
import { EditorItemSearchThumbnail } from "~/ui/item/editor/EditorItemThumbnail";
import { useEditorItemSearchOptions } from "~/ui/item/editor/useEditorItemSearchOptions";

export interface EditorItemAutocompleteFieldProps {
	readonly description?: string;
	readonly label: string;
}

/** Picks one item known by the active compiled editor project. */
export const EditorItemAutocompleteField = ({
	description,
	label,
}: EditorItemAutocompleteFieldProps) => {
	const field = useFieldContext<string>();
	const error = RendererRuntime.runSync(readEditorFieldErrorFx(field.state.meta.errors));
	const { items, options } = useEditorItemSearchOptions();
	return (
		<EditorSearchCombobox
			label={label}
			description={description}
			emptyLabel="No known item matches this search."
			error={error}
			options={options}
			value={field.state.value}
			onBlur={field.handleBlur}
			onChange={field.handleChange}
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
