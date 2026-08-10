import type { EditorInput } from "~/bridge/item/editor/EditorItemModel";
import { EditorChoiceControl, EditorNumberControl } from "~/ui/form/EditorValueControls";
import { EditorQuantityControl } from "~/ui/item/editor/EditorQuantityControl";
import { EditorSelectorControl } from "~/ui/item/editor/EditorSelectorControl";

type EditorMaterialInput = Extract<
	EditorInput,
	{
		readonly type: "materials";
	}
>;

/** Edits the selector, consumption mode, capacity, and quantity of one material input. */
export const EditorMaterialLineInput = ({
	input,
	onChange,
}: {
	readonly input: EditorMaterialInput;
	readonly onChange: (input: EditorMaterialInput) => void;
}) => (
	<div className="grid gap-4">
		<EditorSelectorControl
			value={input.selector}
			onChange={(selector) =>
				onChange({
					...input,
					selector,
				})
			}
		/>
		<div className="grid gap-3 sm:grid-cols-2">
			<EditorChoiceControl
				label="Material mode"
				value={input.mode}
				options={[
					{
						label: "Consume",
						value: "consume",
					},
					{
						label: "Reserve",
						value: "reserve",
					},
				]}
				onChange={(mode) =>
					onChange({
						...input,
						mode,
					})
				}
			/>
			<EditorNumberControl
				label="Extra buffer capacity"
				value={input.capacity}
				min={0}
				onChange={(capacity) =>
					onChange({
						...input,
						capacity,
					})
				}
			/>
		</div>
		<EditorQuantityControl
			value={input.quantity}
			onChange={(quantity) =>
				onChange({
					...input,
					quantity,
				})
			}
		/>
	</div>
);
