import { BatteryMedium, Trash2 } from "lucide-react";
import type { InputSchema as LineInputSchema } from "~/production-input/schema/InputSchema";
import { match } from "ts-pattern";
import { DraftDefaults } from "~/production-authoring/ui/DraftDefaults";
import { QuantityFields } from "~/production-authoring/ui/QuantityControl";
import { BoardDistanceControl } from "~/production-authoring/ui/BoardDistanceControl";
import { SelectorControl } from "~/production-authoring/ui/SelectorControl";
import { Button } from "~/ui/ui/Button";
import { EditorCapabilityStatus } from "~/editor-control/ui/EditorCapabilityStatus";
import { EditorFormSectionDivider } from "~/editor-control/ui/EditorFormSectionDivider";
import { EditorChoiceControl, EditorNumberControl } from "~/editor-control/ui/EditorValueControls";
import { Tooltip } from "~/ui/ui/Tooltip";

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

const InputCharges = ({
	input,
	onChangeFn,
}: {
	readonly input: LineInputSchema.Type;
	readonly onChangeFn: (input: LineInputSchema.Type) => void;
}) => {
	const charges = input.charges;
	return (
		<div className="grid gap-3">
			<EditorFormSectionDivider
				description="Optional charge payment when this input requirement settles."
				title="Charge cost"
				variant="secondary"
			/>
			{charges === undefined ? (
				<EditorCapabilityStatus
					actionLabel="Enable charge cost"
					description="This input currently settles without spending charges. Enable a cost to charge its owner or selected target when the action starts."
					icon={BatteryMedium}
					onEnableFn={() =>
						onChangeFn({
							...input,
							charges: {
								cost: 1,
								from: "self",
							},
						})
					}
					title="Charge cost is disabled"
				/>
			) : (
				<div className="grid items-end gap-3 sm:grid-cols-2">
					<EditorChoiceControl
						label="Paid by"
						value={charges.from}
						options={[
							{
								description:
									"The item that owns this action pays the charge cost. It must define enough available charges.",
								label: "Self",
								value: "self",
							},
							{
								description:
									"The board item resolved by a Deposit input pays the charge cost in place. Only Deposit inputs may charge their target.",
								label: "Target",
								value: "target",
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
					<div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-2">
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
						<Tooltip content="Disable charge cost">
							<Button
								className="size-[var(--ak-control-min-height)] shrink-0 border-0 bg-transparent p-0 shadow-none hover:border-transparent hover:bg-surface-raised active:bg-surface-raised"
								data-ui="EditorInputChargeDisableButton"
								onClick={() =>
									onChangeFn({
										...input,
										charges: undefined,
									})
								}
							>
								<Trash2 className="size-4" />
							</Button>
						</Tooltip>
					</div>
				</div>
			)}
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

const DepositInputControl = ({
	input,
	onChangeFn,
}: {
	readonly input: DepositInput;
	readonly onChangeFn: (input: DepositInput) => void;
}) => (
	<SelectorControl
		value={input.query.selector}
		onChangeFn={(selector) =>
			onChangeFn({
				...input,
				query: {
					...input.query,
					selector,
				},
			})
		}
	/>
);

export const InputControl = ({
	allowMaterials = true,
	input,
	onChangeFn,
}: {
	readonly allowMaterials?: boolean;
	readonly input: LineInputSchema.Type;
	readonly onChangeFn: (input: LineInputSchema.Type) => void;
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
			{match(input)
				.with(
					{
						type: "materials",
					},
					(material) => (
						<MaterialModeControl
							input={material}
							onChangeFn={onChangeFn}
						/>
					),
				)
				.with(
					{
						type: "deposit",
					},
					(deposit) => (
						<BoardDistanceControl
							value={deposit.query}
							onChangeFn={(query) => {
								if (query.scope === "board")
									onChangeFn({
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
				(deposit) => (
					<DepositInputControl
						input={deposit}
						onChangeFn={onChangeFn}
					/>
				),
			)
			.exhaustive()}
		<InputCharges
			input={input}
			onChangeFn={onChangeFn}
		/>
	</article>
);
