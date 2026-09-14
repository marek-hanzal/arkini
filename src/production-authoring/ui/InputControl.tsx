import { useTranslator } from "~/translation/ui/useTranslator";
import type { InputSchema as LineInputSchema } from "~/production-input/schema/InputSchema";
import { match } from "ts-pattern";
import { DraftDefaults } from "~/production-authoring/ui/DraftDefaults";
import { QuantityFields } from "~/production-authoring/ui/QuantityControl";
import { BoardDistanceControl } from "~/production-authoring/ui/BoardDistanceControl";
import { SelectorControl } from "~/production-authoring/ui/SelectorControl";
import { EditorFormSectionDivider } from "~/editor-control/ui/EditorFormSectionDivider";
import { EditorFormBranchEnd } from "~/editor-control/ui/EditorFormBranchEnd";
import { EditorChoiceControl, EditorNumberControl } from "~/editor-control/ui/EditorValueControls";
import type { ItemSchema } from "~/item-definition/schema/ItemSchema";
import { useEditorProject } from "~/authoring-session/ui/useEditorProject";
import type { EditorFormValidationIssue } from "~/editor-control/type/EditorFormValidationIssue";
import { readEditorFormValidationErrorFn } from "~/editor-control/fn/readEditorFormValidationErrorFn";
import { Mx } from "~/translation/ui/Mx";
import type { ReactNode } from "react";

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
					description: <Mx label="Units paid by target help" />,
					label: translator.textFn("Target"),
					value: "target",
				},
				{
					description: <Mx label="Units paid by self help" />,
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
				description={<Mx label="Self unit cost help" />}
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
}) => {
	const translator = useTranslator();
	return (
		<EditorChoiceControl
			error={error}
			label={translator.textFn("Material mode")}
			value={input.mode}
			options={[
				{
					description: <Mx label="Consume material mode help" />,
					label: translator.textFn("Consume"),
					value: "consume",
				},
				{
					description: <Mx label="Reserve material mode help" />,
					label: translator.textFn("Reserve"),
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
};

const MaterialInputControl = ({
	input,
	issues,
	onChangeFn,
}: {
	readonly input: MaterialInput;
	readonly issues: ReadonlyArray<EditorFormValidationIssue>;
	readonly onChangeFn: (input: MaterialInput) => void;
}) => {
	const translator = useTranslator();
	return (
		<div className="grid gap-3">
			<EditorFormSectionDivider
				description={<Mx label="Material required item help" />}
				title={translator.textFn("Required item")}
				variant="secondary"
			/>
			<SelectorControl
				error={readEditorFormValidationErrorFn(issues, "selector")}
				labelVisible={false}
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
					minimumDescription={<Mx label="Material minimum quantity help" />}
					maximumDescription={<Mx label="Material maximum quantity help" />}
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
					description={<Mx label="Material buffer help" />}
					label={translator.textFn("Buffer")}
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
};

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
	const selectedItemUnitAmount = selectedItem?.units?.amount;
	const targetMissingUnits = selectedItem !== undefined && selectedItem.units === undefined;
	const selectedItemError = readEditorFormValidationErrorFn(issues, "query", "selector");
	return (
		<div
			className="grid gap-3"
			data-ui="EditorInputUnitCost"
		>
			<EditorFormSectionDivider
				description={<Mx label="Target unit cost help" />}
				title={translator.textFn("Unit cost")}
				variant="secondary"
			/>
			<SelectorControl
				emptyLabel={translator.textFn("No item with Units enabled matches this search.")}
				error={
					targetMissingUnits
						? translator.textFn("Selected target must have Units enabled.")
						: input.query.selector.itemId === "" && selectedItemError !== undefined
							? translator.textFn("Select an item with Units enabled.")
							: selectedItemError
				}
				includeItemFn={hasUnitsFn}
				labelVisible={false}
				value={input.query.selector}
				onChangeFn={(selector) => {
					const selectedUnitAmount = project.config.items[selector.itemId]?.units?.amount;
					onChangeFn({
						...input,
						units: {
							...units,
							cost:
								selectedUnitAmount === undefined
									? units.cost
									: Math.min(units.cost, selectedUnitAmount),
						},
						query: {
							...input.query,
							selector,
						},
					});
				}}
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
					disabled={selectedItemUnitAmount === undefined}
					error={readEditorFormValidationErrorFn(issues, "units", "cost")}
					label={translator.textFn("Cost")}
					value={units.cost}
					max={selectedItemUnitAmount}
					min={1}
					onChangeFn={(cost) => {
						if (selectedItemUnitAmount === undefined) return;
						onChangeFn({
							...input,
							units: {
								...units,
								cost: Math.min(cost, selectedItemUnitAmount),
							},
						});
					}}
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
			description: <Mx label="Simple input type help" />,
			label: translator.textFn("Simple"),
			value: "simple",
		},
		{
			description: <Mx label="Materials input type help" />,
			label: translator.textFn("Materials"),
			value: "materials",
		},
		{
			description: <Mx label="Units input type help" />,
			label: translator.textFn("Units"),
			value: "units",
		},
	] as const satisfies ReadonlyArray<{
		readonly description: ReactNode;
		readonly label: string;
		readonly value: LineInputSchema.Type["type"];
	}>;

	return (
		<article className="grid gap-4">
			<div className="flex flex-wrap items-start gap-4">
				<EditorChoiceControl
					error={readEditorFormValidationErrorFn(issues, "type")}
					label={translator.textFn("Input type")}
					description={
						allowMaterials ? (
							<Mx label="Production input type help" />
						) : (
							<Mx label="Action input type help" />
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
			<EditorFormBranchEnd />
		</article>
	);
};
