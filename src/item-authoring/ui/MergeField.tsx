import { useTranslator } from "~/translation/ui/useTranslator";
import { PackagePlus } from "lucide-react";

import type { MergeSchema } from "~/item-merge/schema/MergeSchema";
import { EditorFormCard } from "~/editor-control/ui/EditorFormCard";
import { EditorFormSectionDivider } from "~/editor-control/ui/EditorFormSectionDivider";
import { EditorChoiceControl } from "~/editor-control/ui/EditorValueControls";
import { OptionalOutputControl } from "~/production-authoring/ui/OptionalOutputControl";
import { SelectorControl } from "~/production-authoring/ui/SelectorControl";
import { EditorItemReferenceControl } from "~/authoring-form/ui/EditorItemAutocompleteField";
import { useFormValidationIssues } from "~/item-authoring/ui/useFormValidationIssues";
import { readEditorFormValidationErrorFn } from "~/editor-control/fn/readEditorFormValidationErrorFn";

/** Edits the target, effects, replacement, and optional output of one merge definition. */
export const MergeField = ({
	merge,
	onChangeFn,
	sourceUnitsEnabled,
	targetUnitsEnabled,
}: {
	readonly merge: MergeSchema.Type;
	readonly onChangeFn: (merge: MergeSchema.Type) => void;
	readonly sourceUnitsEnabled: boolean;
	readonly targetUnitsEnabled: boolean;
}) => {
	const translator = useTranslator();
	const validationIssues = useFormValidationIssues(merge);
	const sourceError = readEditorFormValidationErrorFn(validationIssues, "action");
	const targetError = readEditorFormValidationErrorFn(validationIssues, "effect");
	return (
		<div className="grid gap-[var(--ak-viewport-gap)]">
			<EditorFormCard>
				<article className="grid grid-cols-2 items-end gap-[var(--ak-panel-padding)]">
					<EditorChoiceControl
						error={
							sourceError !== undefined &&
							merge.action === "spend" &&
							!sourceUnitsEnabled
								? translator.textFn(
										"Enable Units on this item before selecting Spend.",
									)
								: sourceError
						}
						label={translator.textFn("Source action")}
						value={merge.action}
						options={[
							{
								description: translator.textFn(
									"Returns one source quantity after the merge, placing the same item type near the target through normal placement. This does not spend units. A source instance with spent units, remaining lifetime, buffered inputs, or jobs blocks the merge. Example: Reusable Tool + Unlit Candle → Candle; the tool returns nearby with all units unchanged.",
								),
								label: translator.textFn("Use"),
								value: "use",
							},
							{
								description: translator.textFn(
									"Permanently removes one source quantity instead of returning it. This consumes the item itself, not one unit. Removing the last quantity also disposes state owned by that source. Example: Match + Unlit Candle → Candle; one Match disappears.",
								),
								label: translator.textFn("Consume"),
								value: "consume",
							},
							{
								description: sourceUnitsEnabled
									? translator.textFn(
											"Spends one unit from the source item. Spending the last unit depletes one source item and emits its configured depletion output. Example: Flint And Steel + Unlit Candle → Candle; Flint And Steel loses one use.",
										)
									: translator.textFn(
											"Enable Units on this source item before selecting Spend. Spend removes one unit and emits its configured depletion output after the last use.",
										),
								disabled: !sourceUnitsEnabled,
								label: translator.textFn("Spend"),
								value: "spend",
							},
						]}
						onChangeFn={(action) =>
							onChangeFn({
								...merge,
								action,
							})
						}
					/>
					<SelectorControl
						error={readEditorFormValidationErrorFn(validationIssues, "target")}
						value={merge.target}
						onChangeFn={(target) =>
							onChangeFn({
								...merge,
								target,
							})
						}
					/>
					<EditorChoiceControl
						error={
							targetError !== undefined &&
							merge.effect === "spend" &&
							!targetUnitsEnabled
								? translator.textFn(
										"Selected target must have Units enabled before choosing Spend.",
									)
								: targetError
						}
						label={translator.textFn("Target effect")}
						value={merge.effect}
						options={[
							{
								description: translator.textFn(
									"Leaves every target quantity and its state unchanged. The source action and optional merge output still resolve. Example: Key + Chest → reward; the Chest remains unchanged.",
								),
								label: translator.textFn("Keep"),
								value: "keep",
							},
							{
								description: translator.textFn(
									"Permanently removes one target quantity. A larger target stack keeps all remaining quantities. Example: Hammer + Rock → the Rock disappears; the Hammer follows its separate Source action.",
								),
								label: translator.textFn("Remove"),
								value: "remove",
							},
							{
								description: translator.textFn(
									"Replaces one target quantity with the selected item in the same board cell. A larger target stack is split and placed nearby. Previously spent units carry over only to a compatible replacement with units; other target state blocks the merge. Example: Flint + Unlit Candle → Candle; one Unlit Candle becomes one Candle.",
								),
								label: translator.textFn("Replace"),
								value: "replace",
							},
							{
								description: targetUnitsEnabled
									? translator.textFn(
											"Spends one unit from the selected target. Spending its last unit depletes one target item and emits that item's configured depletion output. Example: Empty Wine + Wine Barrel → Wine; the Wine Barrel loses one fill.",
										)
									: translator.textFn(
											"Select a target item with Units enabled before choosing Spend. Spend removes one unit from the target and emits that item's configured depletion output after the last use.",
										),
								disabled: !targetUnitsEnabled,
								label: translator.textFn("Spend"),
								value: "spend",
							},
						]}
						onChangeFn={(effect) =>
							onChangeFn(
								effect === "replace"
									? {
											...merge,
											effect,
											result: merge.effect === "replace" ? merge.result : "",
										}
									: {
											action: merge.action,
											effect,
											output: merge.output,
											target: merge.target,
										},
							)
						}
					/>
					{merge.effect !== "replace" ? null : (
						<EditorItemReferenceControl
							error={readEditorFormValidationErrorFn(validationIssues, "result")}
							label={translator.textFn("Replacement item")}
							value={merge.result}
							onChangeFn={(result) =>
								onChangeFn({
									...merge,
									result,
								})
							}
						/>
					)}
				</article>
			</EditorFormCard>
			<EditorFormSectionDivider
				description={translator.textFn("Optional items emitted after this merge resolves.")}
				title={translator.textFn("Merge output")}
			/>
			<EditorFormCard>
				<OptionalOutputControl
					addLabel={translator.textFn("Enable merge output")}
					emptyDescription={translator.textFn(
						"The merge currently changes only its source and target. Enable an output to emit additional items when it resolves.",
					)}
					emptyIcon={PackagePlus}
					emptyTitle={translator.textFn("Item merge output empty title")}
					value={merge.output}
					onChangeFn={(output) =>
						onChangeFn({
							...merge,
							output,
						})
					}
				/>
			</EditorFormCard>
		</div>
	);
};
