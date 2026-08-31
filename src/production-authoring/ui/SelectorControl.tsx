import type { SelectorSchema } from "~/item-definition/schema/SelectorSchema";
import { EditorItemReferenceControl } from "~/authoring-form/ui/EditorItemAutocompleteField";

interface SelectorControlProps {
	readonly onChangeFn: (selector: SelectorSchema.Type) => void;
	readonly value: SelectorSchema.Type;
}

/** Edits one explicit canonical item selector. */
export const SelectorControl = ({ onChangeFn, value }: SelectorControlProps) => (
	<EditorItemReferenceControl
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
