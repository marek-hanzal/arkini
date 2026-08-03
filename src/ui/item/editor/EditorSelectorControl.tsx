import type { EditorSelector } from "~/bridge/item/editor/EditorItemModel";
import { EditorItemReferenceControl } from "~/ui/item/editor/EditorItemReferenceControl";

export interface EditorSelectorControlProps {
	readonly onChange: (selector: EditorSelector) => void;
	readonly value: EditorSelector;
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
