import type { EditorInput } from "~/bridge/item/editor/EditorItemModel";
import { EditorSelectorControl } from "~/ui/item/editor/EditorSelectorControl";

type EditorDepositInput = Extract<
	EditorInput,
	{
		readonly type: "deposit";
	}
>;

/** Edits the selector of one board-locked deposit input. */
export const EditorDepositLineInput = ({
	input,
	onChange,
}: {
	readonly input: EditorDepositInput;
	readonly onChange: (input: EditorDepositInput) => void;
}) => (
	<EditorSelectorControl
		value={input.query.selector}
		onChange={(selector) =>
			onChange({
				...input,
				query: {
					...input.query,
					selector,
				},
			})
		}
	/>
);
