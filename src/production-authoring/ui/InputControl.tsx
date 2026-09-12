import { useTranslator } from "~/translation/ui/useTranslator";
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
import type { EditorFormValidationIssue } from "~/editor-control/type/EditorFormValidationIssue";
import { readEditorFormValidationErrorFn } from "~/editor-control/fn/readEditorFormValidationErrorFn";

type UnitsInput = Extract<
	LineInputSchema.Type,
	{
		readonly type: "units";
	}
>;

type MaterialInput = Extract<
	LineInputSchema.Type,
	{
		readonly type: "materials";
	}
>;

const hasUnitsFn = (item: ItemSchema.Type) => item.units !== undefined;

const UnitsPaidByControl = ({
	error,
	input,
	onChangeFn,
	ownerItemId,
	selfUnitsEnabled,
}: {
	readonly error?: string;
	readonly input: UnitsInput;
	readonly onChangeFn: (input: UnitsInput) => void;
	readonly ownerItemId: string;
	readonly selfUnitsEnabled: boolean;
}) => {
	const translator = useTranslator();
	const units = input.units ?? DraftDefaults.inputs.units.units;
	return (
		<EditorChoiceControl
			error={
				error !== undefined && units.from === "self" && !selfUnitsEnabled
					? translator.textFn("Enable Units on this item before selecting Self.")
					: error
			}
			label={translator.textFn("Paid by")}
			value={units.from}
			options={[
				{
					description: translator.textFn(
						"The board item resolved by a Units input pays the unit cost in place. Units are spent without moving the target.",
					),
					label: translator.textFn("Target"),
					value: "target",
				},
				{
					description: selfUnitsEnabled
						? translator.textFn(
								"The item that owns this action pays the unit cost. It must define enough available units.",
							)
						: translator.textFn(
								"Enable Units on this item before selecting Self to pay the unit cost.",
							),
					disabled: !selfUnitsEnabled,
					label: translator.textFn("Self"),
					value: "self",
				},
			]}
			onChangeFn={(from) => {
				const switchingBackToTarget = from === "target" && units.from === "self";
				onChangeFn({
					...input,
					units: {
						...units,
						from,
					},
					query:
						from === "self"
							? {
									scope: "board",
									distance: "self",
									selector: {
										type: "item",
										itemId: ownerItemId,
									},
								}
							: switchingBackToTarget
								? structuredClone(DraftDefaults.inputs.units.query)
								: input.query,
				});
			}}
		/>
	);
};

const UnitsSelfUnitCostControl = ({
	error,
	input,
	onChangeFn,
}: {
	readonly error?: string;
	readonly input: UnitsInput;
	readonly onChangeFn: (input: UnitsInput) => void;
}) => {
	const translator = useTranslator();
	const units = input.units ?? DraftDefaults.inputs.units.units;
	return (
		<div
			className="grid gap-3"
			data-ui="EditorInputUnitCost"
		>
			<EditorFormSectionDivider
				description={translator.textFn(
					"Units spent by the item that owns this action when it starts.",
				)}
				title={translator.textFn("Unit cost")}
				variant="secondary"
			/>
			<EditorNumberControl
				error={error}
				label={translator.textFn("Cost")}
				value={units.cost}
				min={1}
				onChangeFn={(cost) =>
					onChangeFn({
						...input,
						units: {
							...units,
							cost,
						},
					})
				}
			/>
		</div>
	);
};

const MaterialModeControl = ({
	error,
	input,
	onChangeFn,
}: {
	readonly error?: string;
	readonly input: MaterialInput;
	readonly onChangeFn: (input: MaterialInput) => void;
}) => (
	<EditorChoiceControl
		error={error}
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
	issues,
	onChangeFn,
}: {
	readonly input: MaterialInput;
	readonly issues: ReadonlyArray<EditorFormValidationIssue>;
	readonly onChangeFn: (input: MaterialInput) => void;
}) => (
	<div className="grid gap-4">
		<SelectorControl
			error={readEditorFormValidationErrorFn(issues, "selector")}
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
				minimumError={readEditorFormValidationErrorFn(issues, "quantity", "min")}
				maximumError={readEditorFormValidationErrorFn(issues, "quantity", "max")}
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
				error={readEditorFormValidationErrorFn(issues, "capacity")}
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

const UnitsTargetUnitCostControl = ({
	input,
	issues,
	onChangeFn,
}: {
	readonly input: UnitsInput;
	readonly issues: ReadonlyArray<EditorFormValidationIssue>;
	readonly onChangeFn: (input: UnitsInput) => void;
}) => {
	const project = useEditorProject();
	const translator = useTranslator();
	const units = input.units ?? DraftDefaults.inputs.units.units;
	const selectedItem = project.config.items[input.query.selector.itemId];
	const targetMissingUnits = selectedItem !== undefined && selectedItem.units === undefined;
	const selectedItemError = readEditorFormValidationErrorFn(issues, "query", "selector");
	return (
		<div
			className="grid gap-3"
			data-ui="EditorInputUnitCost"
		>
			<EditorFormSectionDivider
				description={translator.textFn(
					"Units spent by the selected target when the action starts.",
				)}
				title={translator.textFn("Unit cost")}
				variant="secondary"
			/>
			<SelectorControl
				description={translator.textFn(
					"Only items with Units enabled are shown because the target pays the unit cost.",
				)}
				emptyLabel={translator.textFn("No item with Units enabled matches this search.")}
				error={
					targetMissingUnits
						? translator.textFn("Selected target must have Units enabled.")
						: input.query.selector.itemId === "" && selectedItemError !== undefined
							? translator.textFn("Select an item with Units enabled.")
							: selectedItemError
				}
				includeItemFn={hasUnitsFn}
				value={input.query.selector}
				onChangeFn={(selector) =>
					onChangeFn({
						...input,
						units,
						query: {
							...input.query,
							selector,
						},
					})
				}
			/>
			<div className="grid items-end gap-3 sm:grid-cols-[auto_minmax(0,1fr)]">
				<BoardDistanceControl
					error={readEditorFormValidationErrorFn(issues, "query", "distance")}
					value={input.query}
					onChangeFn={(query) => {
						if (query.scope === "board")
							onChangeFn({
								...input,
								units,
								query,
							});
					}}
				/>
				<EditorNumberControl
					error={readEditorFormValidationErrorFn(issues, "units", "cost")}
					label={translator.textFn("Cost")}
					value={units.cost}
					min={1}
					onChangeFn={(cost) =>
						onChangeFn({
							...input,
							units: {
								...units,
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
	issues = [],
	onChangeFn,
	ownerItemId,
	selfUnitsEnabled,
}: {
	readonly allowMaterials?: boolean;
	readonly input: LineInputSchema.Type;
	readonly issues?: ReadonlyArray<EditorFormValidationIssue>;
	readonly onChangeFn: (input: LineInputSchema.Type) => void;
	readonly ownerItemId: string;
	readonly selfUnitsEnabled: boolean;
}) => {
	const translator = useTranslator();
	const inputTypeOptions = [
		{
			description: translator.textFn(
				"Adds no item or units requirement. The action may start without delivering or targeting another item.",
			),
			label: translator.textFn("Simple"),
			value: "simple",
		},
		{
			description: translator.textFn(
				"Requires matching items to be delivered into this line. They may be consumed or reserved and returned after completion.",
			),
			label: translator.textFn("Materials"),
			value: "materials",
		},
		{
			description: translator.textFn(
				"Spends units from this item or a matching board item when the action starts. The paying item stays in place.",
			),
			label: translator.textFn("Units"),
			value: "units",
		},
	] as const satisfies ReadonlyArray<{
		readonly description: string;
		readonly label: string;
		readonly value: LineInputSchema.Type["type"];
	}>;

	return (
		<article className="grid gap-4">
			<div className="flex flex-wrap items-start justify-between gap-4">
				<EditorChoiceControl
					error={readEditorFormValidationErrorFn(issues, "type")}
					label={translator.textFn("Input type")}
					description={
						allowMaterials
							? translator.textFn(
									"Simple requires no consumable resource. Materials consume or reserve an item, while Units spends units from the owner or a matching board item.",
								)
							: translator.textFn(
									"Simple adds no external item requirement. Units spends units from the owner or a matching item on the current board.",
								)
					}
					value={input.type}
					options={inputTypeOptions.filter(
						(option) => allowMaterials || option.value !== "materials",
					)}
					onChangeFn={(type) => onChangeFn(structuredClone(DraftDefaults.inputs[type]))}
				/>
				{input.type === "materials" ? (
					<MaterialModeControl
						error={readEditorFormValidationErrorFn(issues, "mode")}
						input={input}
						onChangeFn={onChangeFn}
					/>
				) : input.type === "units" ? (
					<UnitsPaidByControl
						error={readEditorFormValidationErrorFn(issues, "units", "from")}
						input={input}
						ownerItemId={ownerItemId}
						selfUnitsEnabled={selfUnitsEnabled}
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
							issues={issues}
							onChangeFn={onChangeFn}
						/>
					),
				)
				.with(
					{
						type: "units",
					},
					(unitsInput) => {
						const units = unitsInput.units ?? DraftDefaults.inputs.units.units;
						return units.from === "target" ? (
							<UnitsTargetUnitCostControl
								input={unitsInput}
								issues={issues}
								onChangeFn={onChangeFn}
							/>
						) : (
							<UnitsSelfUnitCostControl
								error={readEditorFormValidationErrorFn(issues, "units", "cost")}
								input={unitsInput}
								onChangeFn={onChangeFn}
							/>
						);
					},
				)
				.exhaustive()}
		</article>
	);
};
