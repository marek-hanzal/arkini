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
}: {
	readonly merge: MergeSchema.Type;
	readonly onChangeFn: (merge: MergeSchema.Type) => void;
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
									"Uses one source quantity for the merge and returns that same source item to the board afterward. The source must not own state such as charges or jobs.",
								label: "Use",
								value: "use",
							},
							{
								description:
									"Permanently consumes one source quantity when the merge resolves, including state owned by that consumed source.",
								label: "Consume",
								value: "consume",
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
									"Leaves the matched target item unchanged after the merge resolves.",
								label: "Keep",
								value: "keep",
							},
							{
								description:
									"Removes one quantity from the matched target. A larger target stack keeps its remaining quantity.",
								label: "Remove",
								value: "remove",
							},
							{
								description:
									"Replaces one quantity of the matched target with the selected replacement item. Any remaining target stack is placed back nearby.",
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
