import type { EditorInput } from "~/bridge/item/editor/EditorItemModel";
import { EditorQueryControl } from "~/ui/item/editor/EditorQueryControl";

type EditorDepositInput = Extract<
	EditorInput,
	{
		readonly type: "deposit";
	}
>;

/** Edits the board-locked query of one deposit input. */
export const EditorDepositLineInput = ({
	input,
	onChange,
}: {
	readonly input: EditorDepositInput;
	readonly onChange: (input: EditorDepositInput) => void;
}) => (
	<EditorQueryControl
		scopeLocked
		value={input.query}
		onChange={(query) => {
			if (query.scope === "board")
				onChange({
					...input,
					query,
				});
		}}
	/>
);
