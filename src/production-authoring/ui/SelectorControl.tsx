import type { SelectorSchema } from "~/item-definition/schema/SelectorSchema";
import { EditorItemReferenceControl } from "~/authoring-form/ui/EditorItemAutocompleteField";
import type { ItemSchema } from "~/item-definition/schema/ItemSchema";
import type { ReactNode } from "react";

interface SelectorControlProps {
	readonly description?: ReactNode;
	readonly emptyLabel?: string;
	readonly error?: string;
	readonly includeItemFn?: (item: ItemSchema.Type) => boolean;
	readonly label?: string;
	readonly labelVisible?: boolean;
	readonly onChangeFn: (selector: SelectorSchema.Type) => void;
	readonly value: SelectorSchema.Type;
}

/** Edits one explicit canonical item selector. */
export const SelectorControl = ({
	description,
	emptyLabel,
	error,
	includeItemFn,
	label = "Selected item",
	labelVisible = true,
	onChangeFn,
	value,
}: SelectorControlProps) => (
	<EditorItemReferenceControl
		description={description}
		emptyLabel={emptyLabel}
		error={error}
		includeItemFn={includeItemFn}
		label={label}
		labelVisible={labelVisible}
		value={value.itemId}
		onChangeFn={(itemId) =>
			onChangeFn({
				...value,
				itemId,
			})
		}
	/>
);
