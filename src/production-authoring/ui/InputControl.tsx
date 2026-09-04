import type { InputSchema as LineInputSchema } from "~/production-input/schema/InputSchema";
import { match } from "ts-pattern";
import { DraftDefaults } from "~/production-authoring/ui/DraftDefaults";
import { QuantityFields } from "~/production-authoring/ui/QuantityControl";
import { BoardDistanceControl } from "~/production-authoring/ui/BoardDistanceControl";
import { SelectorControl } from "~/production-authoring/ui/SelectorControl";
import { EditorFormSectionDivider } from "~/editor-control/ui/EditorFormSectionDivider";
import { EditorChoiceControl, EditorNumberControl } from "~/editor-control/ui/EditorValueControls";
import type { ItemSchema } from "~/item-definition/schema/ItemSchema";
import { useEditorProject } from "~/authoring-session/ui/useEditorProject";

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

type DepositInput = Extract<
	LineInputSchema.Type,
	{
		readonly type: "deposit";
	}
>;

type MaterialInput = Extract<
	LineInputSchema.Type,
	{
		readonly type: "materials";
	}
>;

const hasChargesFn = (item: ItemSchema.Type) => item.charges !== undefined;

const DepositPaidByControl = ({
	input,
	onChangeFn,
	selfChargesEnabled,
}: {
	readonly input: DepositInput;
	readonly onChangeFn: (input: DepositInput) => void;
	readonly selfChargesEnabled: boolean;
}) => {
	const charges = input.charges ?? DraftDefaults.inputs.deposit.charges;
	return (
		<EditorChoiceControl
			label="Paid by"
			value={charges.from}
			options={[
				{
					description:
						"The board item resolved by a Deposit input pays the charge cost in place. Only Deposit inputs may charge their target.",
					label: "Target",
					value: "target",
				},
				{
					description: selfChargesEnabled
						? "The item that owns this action pays the charge cost. It must define enough available charges."
						: "Enable Charges on this item before selecting Self to pay its Deposit charge cost.",
					disabled: !selfChargesEnabled,
					label: "Self",
					value: "self",
				},
			]}
			onChangeFn={(from) =>
				onChangeFn({
					...input,
					charges: {
						...charges,
						from,
					},
				})
			}
		/>
	);
};

const DepositSelfChargeCostControl = ({
	input,
	onChangeFn,
}: {
	readonly input: DepositInput;
	readonly onChangeFn: (input: DepositInput) => void;
}) => {
	const charges = input.charges ?? DraftDefaults.inputs.deposit.charges;
	return (
		<div className="grid gap-3" data-ui="EditorInputChargeCost">
			<EditorFormSectionDivider
				description="Charge payment made by the item that owns this action when the Deposit input settles."
				title="Charge cost"
				variant="secondary"
			/>
			<EditorNumberControl
				label="Cost"
				value={charges.cost}
				min={1}
				onChangeFn={(cost) =>
					onChangeFn({
						...input,
						charges: {
							...charges,
							cost,
						},
					})
				}
			/>
		</div>
	);
};

const MaterialModeControl = ({
	input,
	onChangeFn,
}: {
	readonly input: MaterialInput;
	readonly onChangeFn: (input: MaterialInput) => void;
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
		onChangeFn={(mode) =>
			onChangeFn({
				...input,
				mode,
			})
		}
	/>
);

const MaterialInputControl = ({
	input,
	onChangeFn,
}: {
	readonly input: MaterialInput;
	readonly onChangeFn: (input: MaterialInput) => void;
}) => (
	<div className="grid gap-4">
		<SelectorControl
			value={input.selector}
			onChangeFn={(selector) =>
				onChangeFn({
					...input,
					selector,
				})
			}
		/>
		<div className="grid gap-3 sm:grid-cols-3">
			<QuantityFields
				minimumDescription="Minimum matching material quantity required before this line can start. If this amount is available, the run becomes ready."
				maximumDescription="Maximum matching material quantity one run consumes or reserves. A ready run uses what is currently stored, capped at this amount."
				value={input.quantity}
				onChangeFn={(quantity) =>
					onChangeFn({
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
				onChangeFn={(capacity) =>
					onChangeFn({
						...input,
						capacity,
					})
				}
			/>
		</div>
	</div>
);

const DepositTargetChargeCostControl = ({
	input,
	onChangeFn,
}: {
	readonly input: DepositInput;
	readonly onChangeFn: (input: DepositInput) => void;
}) => {
	const project = useEditorProject();
	const charges = input.charges ?? DraftDefaults.inputs.deposit.charges;
	const selectedItem = project.config.items[input.query.selector.itemId];
	const targetMissingCharges =
		selectedItem !== undefined && selectedItem.charges === undefined;
	return (
		<div className="grid gap-3" data-ui="EditorInputChargeCost">
			<EditorFormSectionDivider
				description="Charge payment made by the selected Deposit target when this input settles."
				title="Charge cost"
				variant="secondary"
			/>
			<SelectorControl
				description="Only items with Charges enabled are shown because the selected target pays this Deposit charge cost."
				emptyLabel="No item with Charges enabled matches this search."
				error={
					targetMissingCharges ? "Selected target must have Charges enabled." : undefined
				}
				includeItemFn={hasChargesFn}
				value={input.query.selector}
				onChangeFn={(selector) =>
					onChangeFn({
						...input,
						charges,
						query: {
							...input.query,
							selector,
						},
					})
				}
			/>
			<div className="grid items-end gap-3 sm:grid-cols-[auto_minmax(0,1fr)]">
				<BoardDistanceControl
					value={input.query}
					onChangeFn={(query) => {
						if (query.scope === "board")
							onChangeFn({
								...input,
								charges,
								query,
							});
					}}
				/>
				<EditorNumberControl
					label="Cost"
					value={charges.cost}
					min={1}
					onChangeFn={(cost) =>
						onChangeFn({
							...input,
							charges: {
								...charges,
								cost,
							},
						})
					}
				/>
			</div>
		</div>
	);
};

export const InputControl = ({
	allowMaterials = true,
	input,
	onChangeFn,
	selfChargesEnabled,
}: {
	readonly allowMaterials?: boolean;
	readonly input: LineInputSchema.Type;
	readonly onChangeFn: (input: LineInputSchema.Type) => void;
	readonly selfChargesEnabled: boolean;
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
				onChangeFn={(type) => onChangeFn(structuredClone(DraftDefaults.inputs[type]))}
			/>
			{input.type === "materials" ? (
				<MaterialModeControl
					input={input}
					onChangeFn={onChangeFn}
				/>
			) : input.type === "deposit" ? (
				<DepositPaidByControl
					input={input}
					selfChargesEnabled={selfChargesEnabled}
					onChangeFn={onChangeFn}
				/>
			) : null}
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
					<MaterialInputControl
						input={material}
						onChangeFn={onChangeFn}
					/>
				),
			)
			.with(
				{
					type: "deposit",
				},
				(deposit) => {
					const charges = deposit.charges ?? DraftDefaults.inputs.deposit.charges;
					return charges.from === "target" ? (
						<DepositTargetChargeCostControl
							input={deposit}
							onChangeFn={onChangeFn}
						/>
					) : (
						<DepositSelfChargeCostControl
							input={deposit}
							onChangeFn={onChangeFn}
						/>
					);
				},
			)
			.exhaustive()}
	</article>
);
