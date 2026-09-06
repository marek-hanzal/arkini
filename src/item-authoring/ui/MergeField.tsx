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
	sourceChargesEnabled,
}: {
	readonly merge: MergeSchema.Type;
	readonly onChangeFn: (merge: MergeSchema.Type) => void;
	readonly sourceChargesEnabled: boolean;
}) => {
	const validationIssues = useFormValidationIssues(merge);
	return (
		<div className="grid gap-[var(--ak-viewport-gap)]">
			<EditorFormCard>
				<article className="grid grid-cols-2 items-end gap-[var(--ak-panel-padding)]">
					<EditorChoiceControl
						error={readEditorFormValidationErrorFn(validationIssues, "action")}
						label="Source action"
						value={merge.action}
						options={[
							{
								description:
									"Returns one source quantity after the merge, placing the same item type near the target through normal placement. This does not spend charges. A source instance with spent charges, remaining lifetime, buffered inputs, or jobs blocks the merge. Example: Reusable Tool + Unlit Candle → Candle; the tool returns nearby with all charges unchanged.",
								label: "Use",
								value: "use",
							},
							{
								description:
									"Permanently removes one source quantity instead of returning it. This consumes the item itself, not one charge. Removing the last quantity also disposes state owned by that source. Example: Match + Unlit Candle → Candle; one Match disappears.",
								label: "Consume",
								value: "consume",
							},
							{
								description: sourceChargesEnabled
									? "Spends one actual source charge. Spending the last charge depletes one source item and emits its configured depletion output. Example: Flint And Steel + Unlit Candle → Candle; Flint And Steel loses one use."
									: "Enable Charges on this source item before selecting Deposit. Deposit spends one actual charge and emits its configured depletion output after the last use.",
								disabled: !sourceChargesEnabled,
								label: "Deposit",
								value: "deposit",
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
						error={readEditorFormValidationErrorFn(validationIssues, "effect")}
						label="Target effect"
						value={merge.effect}
						options={[
							{
								description:
									"Leaves every target quantity and its state unchanged. The source action and optional merge output still resolve. Example: Key + Chest → reward; the Chest remains unchanged.",
								label: "Keep",
								value: "keep",
							},
							{
								description:
									"Permanently removes one target quantity. A larger target stack keeps all remaining quantities. Example: Hammer + Rock → the Rock disappears; the Hammer follows its separate Source action.",
								label: "Remove",
								value: "remove",
							},
							{
								description:
									"Replaces one target quantity with the selected item in the same board cell. A larger target stack is split and placed nearby. Previously spent charges carry over only to a compatible charged replacement; other target state blocks the merge. Example: Flint + Unlit Candle → Candle; one Unlit Candle becomes one Candle.",
								label: "Replace",
								value: "replace",
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
							label="Replacement item"
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
				description="Optional items emitted after this merge resolves."
				title="Merge output"
			/>
			<EditorFormCard>
				<OptionalOutputControl
					addLabel="Enable merge output"
					emptyDescription="The merge currently changes only its source and target. Enable an output to emit additional items when it resolves."
					emptyIcon={PackagePlus}
					emptyTitle="No merge output"
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
