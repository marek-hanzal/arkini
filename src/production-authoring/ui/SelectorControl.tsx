import type { SelectorSchema } from "~/item-definition/schema/SelectorSchema";
import { EditorItemReferenceControl } from "~/authoring-form/ui/EditorItemAutocompleteField";
import type { ItemSchema } from "~/item-definition/schema/ItemSchema";

interface SelectorControlProps {
	readonly description?: string;
	readonly emptyLabel?: string;
	readonly error?: string;
	readonly includeItemFn?: (item: ItemSchema.Type) => boolean;
	readonly onChangeFn: (selector: SelectorSchema.Type) => void;
	readonly value: SelectorSchema.Type;
}

/** Edits one explicit canonical item selector. */
export const SelectorControl = ({
	description,
	emptyLabel,
	error,
	includeItemFn,
	onChangeFn,
	value,
}: SelectorControlProps) => (
	<EditorItemReferenceControl
		description={description}
		emptyLabel={emptyLabel}
		error={error}
		includeItemFn={includeItemFn}
		label="Selected item"
		value={value.itemId}
		onChangeFn={(itemId) =>
			onChangeFn({
				...value,
				itemId,
			})
		}
	/>
);
