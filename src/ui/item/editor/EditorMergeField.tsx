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
			<article className="grid grid-cols-2 gap-[var(--ak-panel-padding)]">
				<div className="grid content-start gap-4">
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
						label="Source action"
						value={merge.action}
						options={[
							{
								label: "Use",
								value: "use",
							},
							{
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
				</div>
				<div className="grid content-start gap-4">
					<EditorChoiceControl
						label="Target effect"
						value={merge.effect}
						options={[
							{
								label: "Keep",
								value: "keep",
							},
							{
								label: "Remove",
								value: "remove",
							},
							{
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
				</div>
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
