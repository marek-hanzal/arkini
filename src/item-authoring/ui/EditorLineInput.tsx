import type { InputSchema as LineInputSchema } from "~/production-input/schema/InputSchema";
import { match } from "ts-pattern";
import { EditorChoiceControl } from "~/ui/form/EditorValueControls";
import { EditorDepositLineInput } from "~/item-authoring/ui/EditorDepositLineInput";
import { EditorInputCharges } from "~/item-authoring/ui/EditorInputCharges";
import { EditorItemDraftDefaults } from "~/item-authoring/ui/EditorItemDraftDefaults";
import {
	EditorMaterialLineInput,
	EditorMaterialModeControl,
} from "~/item-authoring/ui/EditorMaterialLineInput";
import { EditorBoardDistanceControl } from "~/item-authoring/ui/EditorQueryControl";

const inputTypeOptions = [
	{
		description:
			"Adds no item or deposit requirement. The action may start without delivering or targeting another item.",
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
			"Targets one matching board item in place. It is not delivered; its configured charge cost is paid when the action starts.",
		label: "Deposit",
		value: "deposit",
	},
] as const satisfies ReadonlyArray<{
	readonly description: string;
	readonly label: string;
	readonly value: LineInputSchema.Type["type"];
}>;

export const EditorLineInput = ({
	allowMaterials = true,
	input,
	onChange,
}: {
	readonly allowMaterials?: boolean;
	readonly input: LineInputSchema.Type;
	readonly onChange: (input: LineInputSchema.Type) => void;
}) => (
	<article className="grid gap-4">
		<div className="flex flex-wrap items-start justify-between gap-4">
			<EditorChoiceControl
				label="Input type"
				description={
					allowMaterials
						? "Simple explicitly requires no consumable resource. Materials consume or reserve an item, while Deposit targets a matching board deposit."
						: "Simple adds no external item requirement. Deposit targets a matching item on the current board."
				}
				value={input.type}
				options={inputTypeOptions.filter(
					(option) => allowMaterials || option.value !== "materials",
				)}
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
