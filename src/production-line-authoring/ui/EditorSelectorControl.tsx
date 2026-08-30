import type { SelectorSchema } from "~/item-definition/schema/SelectorSchema";
import { EditorItemReferenceControl } from "~/ui/item/EditorItemAutocompleteField";

interface EditorSelectorControlProps {
	readonly onChange: (selector: SelectorSchema.Type) => void;
	readonly value: SelectorSchema.Type;
}

/** Edits one explicit canonical item selector. */
export const EditorSelectorControl = ({ onChange, value }: EditorSelectorControlProps) => (
	<EditorItemReferenceControl
		label="Selected item"
		value={value.itemId}
		onChange={(itemId) =>
			onChange({
				...value,
				itemId,
			})
		}
	/>
);
