import type { EditorInput } from "~/bridge/item/editor/EditorItemModel";
import { EditorChoiceControl, EditorNumberControl } from "~/ui/form/EditorValueControls";
import { EditorQuantityFields } from "~/ui/item/editor/EditorQuantityControl";
import { EditorSelectorControl } from "~/ui/item/editor/EditorSelectorControl";

type EditorMaterialInput = Extract<
	EditorInput,
	{
		readonly type: "materials";
	}
>;

export const EditorMaterialModeControl = ({
	input,
	onChange,
}: {
	readonly input: EditorMaterialInput;
	readonly onChange: (input: EditorMaterialInput) => void;
}) => (
	<EditorChoiceControl
		label="Material mode"
		value={input.mode}
		options={[
			{
				description:
					"Uses the delivered material for this run. The committed item is removed when production completes.",
				label: "Consume",
				value: "consume",
			},
			{
				description:
					"Keeps the delivered material reserved during production and returns the same item when the run completes.",
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
);

/** Edits the selector, capacity, and quantity of one material input. */
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
		<div className="grid gap-3 sm:grid-cols-3">
			<EditorQuantityFields
				minimumDescription="Minimum matching material quantity required before this line can start. If this amount is available, the run becomes ready."
				maximumDescription="Maximum matching material quantity one run consumes or reserves. A ready run uses what is currently stored, capped at this amount."
				value={input.quantity}
				onChange={(quantity) =>
					onChange({
						...input,
						quantity,
					})
				}
			/>
			<EditorNumberControl
				description="Additional quantity this input may hold above Maximum. The buffer does not increase how much one run consumes or reserves."
				label="Buffer"
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
	</div>
);
