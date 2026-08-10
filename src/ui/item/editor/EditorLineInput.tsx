import { match } from "ts-pattern";

import type { EditorInput } from "~/bridge/item/editor/EditorItemModel";
import { EditorChoiceControl } from "~/ui/form/EditorValueControls";
import { EditorDepositLineInput } from "~/ui/item/editor/EditorDepositLineInput";
import { EditorInputCharges } from "~/ui/item/editor/EditorInputCharges";
import { EditorItemDraftDefaults } from "~/ui/item/editor/EditorItemDraftDefaults";
import { EditorMaterialLineInput } from "~/ui/item/editor/EditorMaterialLineInput";

export const EditorLineInput = ({
	input,
	onChange,
}: {
	readonly input: EditorInput;
	readonly onChange: (input: EditorInput) => void;
}) => (
	<article className="grid gap-4">
		<EditorChoiceControl
			label="Input type"
			description="Simple explicitly requires no consumable resource. Materials consume or reserve an item, while Deposit targets a matching board deposit."
			value={input.type}
			options={[
				{
					label: "Simple",
					value: "simple",
				},
				{
					label: "Materials",
					value: "materials",
				},
				{
					label: "Deposit",
					value: "deposit",
				},
			]}
			onChange={(type) => onChange(structuredClone(EditorItemDraftDefaults.inputs[type]))}
		/>
		{match(input)
			.with(
				{
					type: "simple",
				},
				() => null,
			)
			.with(
				{
					type: "materials",
				},
				(material) => (
					<EditorMaterialLineInput
						input={material}
						onChange={onChange}
					/>
				),
			)
			.with(
				{
					type: "deposit",
				},
				(deposit) => (
					<EditorDepositLineInput
						input={deposit}
						onChange={onChange}
					/>
				),
			)
			.exhaustive()}
		<EditorInputCharges
			input={input}
			onChange={onChange}
		/>
	</article>
);
