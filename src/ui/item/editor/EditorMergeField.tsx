import type { EditorMerge } from "~/bridge/item/editor/EditorItemModel";
import { EditorFormCard } from "~/ui/form/EditorFormCard";
import { EditorFormSectionDivider } from "~/ui/form/EditorFormSectionDivider";
import { EditorChoiceControl } from "~/ui/form/EditorValueControls";
import { EditorItemReferenceControl } from "~/ui/item/editor/EditorItemReferenceControl";
import { EditorOptionalOutputControl } from "~/ui/item/editor/EditorOptionalOutputControl";
import { EditorSelectorControl } from "~/ui/item/editor/EditorSelectorControl";

/** Edits the target, effects, replacement, and optional output of one merge definition. */
export const EditorMergeField = ({
	merge,
	onChange,
}: {
	readonly merge: EditorMerge;
	readonly onChange: (merge: EditorMerge) => void;
}) => (
	<div className="grid gap-[var(--ak-viewport-gap)]">
		<EditorFormCard>
			<article className="grid grid-cols-2 items-end gap-[var(--ak-panel-padding)]">
				<EditorChoiceControl
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
					onChange={(action) =>
						onChange({
							...merge,
							action,
						})
					}
				/>
				<EditorSelectorControl
					value={merge.target}
					onChange={(target) =>
						onChange({
							...merge,
							target,
						})
					}
				/>
				<EditorChoiceControl
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
					onChange={(effect) =>
						onChange(
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
						label="Replacement item"
						value={merge.result}
						onChange={(result) =>
							onChange({
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
			<EditorOptionalOutputControl
				addLabel="Enable merge output"
				emptyDescription="The merge currently changes only its source and target. Enable an output to emit additional items when it resolves."
				emptyIcon="icon-[lucide--package-plus]"
				emptyTitle="No merge output"
				value={merge.output}
				onChange={(output) =>
					onChange({
						...merge,
						output,
					})
				}
			/>
		</EditorFormCard>
	</div>
);
