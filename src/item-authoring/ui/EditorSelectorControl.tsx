import type { SelectorSchema } from "~/engine/selector/schema/SelectorSchema";
import { EditorItemReferenceControl } from "~/item-authoring/ui/EditorItemReferenceControl";

export interface EditorSelectorControlProps {
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
