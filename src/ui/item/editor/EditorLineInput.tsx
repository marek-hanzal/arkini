import { match } from "ts-pattern";

import type { EditorInput } from "~/bridge/item/editor/EditorItemModel";
import { EditorChoiceControl } from "~/ui/form/EditorValueControls";
import { EditorDepositLineInput } from "~/ui/item/editor/EditorDepositLineInput";
import { EditorInputCharges } from "~/ui/item/editor/EditorInputCharges";
import { EditorItemDraftDefaults } from "~/ui/item/editor/EditorItemDraftDefaults";
import {
	EditorMaterialLineInput,
	EditorMaterialModeControl,
} from "~/ui/item/editor/EditorMaterialLineInput";
import { EditorBoardDistanceControl } from "~/ui/item/editor/EditorQueryControl";

export const EditorLineInput = ({
	input,
	onChange,
}: {
	readonly input: EditorInput;
	readonly onChange: (input: EditorInput) => void;
}) => (
	<article className="grid gap-4">
		<div className="flex flex-wrap items-start justify-between gap-4">
			<EditorChoiceControl
				label="Input type"
				description="Simple explicitly requires no consumable resource. Materials consume or reserve an item, while Deposit targets a matching board deposit."
				value={input.type}
				options={[
					{
						description:
							"Adds no item or deposit requirement. The line may start without delivering or targeting another item.",
						label: "Simple",
						value: "simple",
					},
					{
						description:
							"Requires matching items to be delivered into this line. They may be consumed or reserved and returned after completion.",
						label: "Materials",
						value: "materials",
					},
					{
						description:
							"Targets one matching board item in place. It is not delivered; its configured charge cost is paid when production starts.",
						label: "Deposit",
						value: "deposit",
					},
				]}
				onChange={(type) => onChange(structuredClone(EditorItemDraftDefaults.inputs[type]))}
			/>
			{match(input)
				.with(
					{
						type: "materials",
					},
					(material) => (
						<EditorMaterialModeControl
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
						<EditorBoardDistanceControl
							value={deposit.query}
							onChange={(query) => {
								if (query.scope === "board")
									onChange({
										...deposit,
										query,
									});
							}}
						/>
					),
				)
				.otherwise(() => null)}
		</div>
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
