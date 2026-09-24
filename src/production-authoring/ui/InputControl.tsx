import { useTranslator } from "~/translation/ui/useTranslator";
import type { InputSchema as LineInputSchema } from "~/production-input/schema/InputSchema";
import { match, P } from "ts-pattern";
import { DraftDefaults } from "~/production-authoring/ui/DraftDefaults";
import { QuantityFields } from "~/production-authoring/ui/QuantityControl";
import { BoardDistanceControl } from "~/production-authoring/ui/BoardDistanceControl";
import { SelectorControl } from "~/production-authoring/ui/SelectorControl";
import { SectionEnd } from "~/ui/ui/SectionEnd";
import { EditorNumberControl } from "~/editor-control/ui/EditorValueControls";
import type { ItemSchema } from "~/item-definition/schema/ItemSchema";
import { useEditorProject } from "~/authoring-session/ui/useEditorProject";
import type { EditorFormValidationIssue } from "~/editor-control/type/EditorFormValidationIssue";
import { readEditorFormValidationErrorFn } from "~/editor-control/fn/readEditorFormValidationErrorFn";
import { Mx } from "~/translation/ui/Mx";

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
			<EditorNumberControl
				description={<Mx label="Self unit cost help" />}
				error={error}
				label={translator.textFn("Unit cost")}
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
			<SelectorControl
				description={<Mx label="Material required item help" />}
				error={readEditorFormValidationErrorFn(issues, "query", "selector")}
				label={translator.textFn("Required item")}
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
			<div className="grid grid-cols-2 items-start gap-3">
				<div className="grid min-w-0 grid-cols-2 gap-3">
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
				</div>
				<div className="flex min-w-0 justify-end">
					<BoardDistanceControl
						error={readEditorFormValidationErrorFn(issues, "query", "distance")}
						value={input.query}
						onChangeFn={(query) =>
							onChangeFn({
								...input,
								query,
							})
						}
					/>
				</div>
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
	const selectedItem = project.config.items[input.query.selector.itemUid];
	const selectedItemUnitAmount = selectedItem?.units?.amount;
	const targetMissingUnits = selectedItem !== undefined && selectedItem.units === undefined;
	const selectedItemError = readEditorFormValidationErrorFn(issues, "query", "selector");
	return (
		<div
			className="grid gap-3"
			data-ui="EditorInputUnitCost"
		>
			<SelectorControl
				description={<Mx label="Target unit cost help" />}
				emptyLabel={translator.textFn("No item with Units enabled matches this search.")}
				error={match({
					targetMissingUnits,
					itemUid: input.query.selector.itemUid,
					selectedItemError,
				})
					.with(
						{
							targetMissingUnits: true,
						},
						() => translator.textFn("Selected target must have Units enabled."),
					)
					.with(
						{
							itemUid: "",
							selectedItemError: P.string,
						},
						() => translator.textFn("Select an item with Units enabled."),
					)
					.otherwise(() => selectedItemError)}
				includeItemFn={hasUnitsFn}
				label={translator.textFn("Unit cost")}
				value={input.query.selector}
				onChangeFn={(selector) => {
					const selectedUnitAmount =
						project.config.items[selector.itemUid]?.units?.amount;
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
			<div className="grid grid-cols-2 items-start gap-3">
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
				<div className="flex min-w-0 justify-end">
					<BoardDistanceControl
						error={readEditorFormValidationErrorFn(issues, "query", "distance")}
						value={input.query}
						onChangeFn={(query) => {
							onChangeFn({
								...input,
								units,
								query,
							});
						}}
					/>
				</div>
			</div>
		</div>
	);
};

export const InputControl = ({
	input,
	issues = [],
	onChangeFn,
	selfUnitsEnabled,
}: {
	readonly input: LineInputSchema.Type;
	readonly issues?: ReadonlyArray<EditorFormValidationIssue>;
	readonly onChangeFn: (input: LineInputSchema.Type) => void;
	readonly selfUnitsEnabled: boolean;
}) => {
	const translator = useTranslator();

	return (
		<article className="grid gap-4">
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
								error={
									!selfUnitsEnabled
										? translator.textFn(
												"Enable Units on this item before selecting Self.",
											)
										: (readEditorFormValidationErrorFn(
												issues,
												"units",
												"from",
											) ??
											readEditorFormValidationErrorFn(
												issues,
												"units",
												"cost",
											))
								}
								input={unitsInput}
								onChangeFn={onChangeFn}
							/>
						);
					},
				)
				.exhaustive()}
			<SectionEnd />
		</article>
	);
};
