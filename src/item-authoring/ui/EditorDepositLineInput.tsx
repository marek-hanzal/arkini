import type { InputSchema as LineInputSchema } from "~/production-input/schema/InputSchema";
import { EditorSelectorControl } from "~/item-authoring/ui/EditorSelectorControl";

type EditorDepositInput = Extract<
	LineInputSchema.Type,
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
