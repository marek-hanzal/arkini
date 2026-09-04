import { useFieldContext } from "~/editor-control/ui/EditorFormContexts";
import { readEditorFieldErrorFn } from "~/editor-control/fn/readEditorFieldErrorFn";
import { EditorSearchCombobox } from "~/editor-control/ui/EditorSearchCombobox";
import { EditorItemSearchThumbnail } from "~/authoring-form/ui/EditorItemThumbnail";
import { useEditorItemSearchOptions } from "~/authoring-form/ui/useEditorItemSearchOptions";

interface EditorItemAutocompleteFieldProps {
	readonly description?: string;
	readonly label: string;
}

/** Picks one item known by the active compiled editor project. */
export const EditorItemAutocompleteField = ({
	description,
	label,
}: EditorItemAutocompleteFieldProps) => {
	const field = useFieldContext<string>();
	const error = readEditorFieldErrorFn(field.state.meta.errors);
	const { items, options } = useEditorItemSearchOptions();
	return (
		<EditorSearchCombobox
			label={label}
			description={description}
			emptyLabel="No known item matches this search."
			error={error}
			options={options}
			required
			value={field.state.value}
			onBlurFn={field.handleBlur}
			onChangeFn={field.handleChange}
			renderPreviewFn={(option) => <EditorItemSearchThumbnail item={items?.[option.id]} />}
			renderSelectedPreviewFn={(option) => (
				<EditorItemSearchThumbnail
					item={items?.[option.id]}
					selected
				/>
			)}
		/>
	);
};

interface EditorItemReferenceControlProps {
	readonly label: string;
	readonly onChangeFn: (itemId: string) => void;
	readonly value: string;
}

/** Reuses the canonical item autocomplete outside direct TanStack field bindings. */
export const EditorItemReferenceControl = ({
	label,
	onChangeFn,
	value,
}: EditorItemReferenceControlProps) => {
	const { items, options } = useEditorItemSearchOptions();
	return (
		<EditorSearchCombobox
			label={label}
			emptyLabel="No known item matches this search."
			options={options}
			required
			value={value}
			onChangeFn={onChangeFn}
			renderPreviewFn={(option) => <EditorItemSearchThumbnail item={items?.[option.id]} />}
			renderSelectedPreviewFn={(option) => (
				<EditorItemSearchThumbnail
					item={items?.[option.id]}
					selected
				/>
			)}
		/>
	);
};
