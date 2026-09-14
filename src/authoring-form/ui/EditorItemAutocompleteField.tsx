import { useFieldContext } from "~/editor-control/ui/EditorFormContexts";
import { readEditorFieldErrorFn } from "~/editor-control/fn/readEditorFieldErrorFn";
import { EditorSearchCombobox } from "~/editor-control/ui/EditorSearchCombobox";
import { EditorItemSearchThumbnail } from "~/authoring-form/ui/EditorItemThumbnail";
import { useEditorItemSearchOptions } from "~/authoring-form/ui/useEditorItemSearchOptions";
import type { ItemSchema } from "~/item-definition/schema/ItemSchema";
import type { ReactNode } from "react";

interface EditorItemAutocompleteFieldProps {
	readonly description?: ReactNode;
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
			displaySelectedLabel
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
					item={option === undefined ? undefined : items?.[option.id]}
					selected
				/>
			)}
		/>
	);
};

interface EditorItemReferenceControlProps {
	readonly description?: ReactNode;
	readonly emptyLabel?: string;
	readonly error?: string;
	readonly includeItemFn?: (item: ItemSchema.Type) => boolean;
	readonly label: string;
	readonly labelVisible?: boolean;
	readonly onChangeFn: (itemId: string) => void;
	readonly value: string;
	readonly showSelectedPreview?: boolean;
}

/** Reuses the canonical item autocomplete outside direct TanStack field bindings. */
export const EditorItemReferenceControl = ({
	description,
	emptyLabel = "No known item matches this search.",
	error,
	includeItemFn,
	label,
	labelVisible = true,
	onChangeFn,
	showSelectedPreview = true,
	value,
}: EditorItemReferenceControlProps) => {
	const { items, options } = useEditorItemSearchOptions(includeItemFn);
	return (
		<EditorSearchCombobox
			displaySelectedLabel
			description={description}
			label={label}
			labelVisible={labelVisible}
			emptyLabel={emptyLabel}
			error={error}
			options={options}
			value={value}
			onChangeFn={onChangeFn}
			renderPreviewFn={(option) => <EditorItemSearchThumbnail item={items?.[option.id]} />}
			renderSelectedPreviewFn={
				showSelectedPreview
					? (option) => (
							<EditorItemSearchThumbnail
								item={option === undefined ? undefined : items?.[option.id]}
								selected
							/>
						)
					: undefined
			}
		/>
	);
};
