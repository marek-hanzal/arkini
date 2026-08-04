import type { EditorMerge } from "~/bridge/item/editor/EditorItemModel";
import { EditorCapabilityStatus } from "~/ui/form/EditorCapabilityStatus";
import { EditorCollectionSelector } from "~/ui/form/EditorCollectionSelector";
import { EditorFormCard } from "~/ui/form/EditorFormCard";
import { EditorFormSeparator } from "~/ui/form/EditorFormSeparator";
import { EditorItemDraftDefaults } from "~/ui/item/editor/EditorItemDraftDefaults";
import { EditorChoiceControl } from "~/ui/form/EditorValueControls";
import { EditorItemReferenceControl } from "~/ui/item/editor/EditorItemReferenceControl";
import { EditorOptionalOutputControl } from "~/ui/item/editor/EditorOptionalOutputControl";
import { EditorSelectorControl } from "~/ui/item/editor/EditorSelectorControl";
import { useEditorItemOptionLabel } from "~/ui/item/editor/useEditorItemOptionLabel";

/** Edits the optional non-empty merge array without coupling it to one form API. */
export const EditorMergeFields = ({
	onChange,
	value,
}: {
	readonly onChange: (value: EditorMerge[] | undefined) => void;
	readonly value: EditorMerge[] | undefined;
}) => {
	const readItemLabel = useEditorItemOptionLabel();
	const merges = value ?? [];
	const update = (index: number, merge: EditorMerge) => {
		const next = [
			...merges,
		];
		next[index] = merge;
		onChange(next);
	};
	return (
		<div className="grid gap-[var(--ak-viewport-gap)]">
			{merges.length === 0 ? (
				<EditorFormCard>
					<EditorCapabilityStatus
						actionLabel="Enable merges"
						description="Merges let dropping this item onto a matching target consume or retain the source, change the target and optionally emit an output."
						icon="icon-[lucide--combine]"
						onEnable={() =>
							onChange([
								structuredClone(EditorItemDraftDefaults.merge),
							])
						}
						title="Merges are disabled"
					/>
				</EditorFormCard>
			) : (
				<EditorCollectionSelector
					addLabel="Add merge"
					count={merges.length}
					itemLabel={(index) => {
						const itemId = merges[index].target.itemId;
						return readItemLabel(itemId, `Merge ${index + 1}`);
					}}
					label="Merges"
					navigationCard
					onAdd={() =>
						onChange([
							...merges,
							structuredClone(EditorItemDraftDefaults.merge),
						])
					}
					onRemove={(index) => {
						const next = merges.filter((_merge, candidate) => candidate !== index);
						onChange(next.length === 0 ? undefined : next);
					}}
					removeLabel="Remove merge"
				>
					{(index) => {
						const merge = merges[index];
						return (
							<div className="grid gap-[var(--ak-viewport-gap)]">
								<EditorFormCard>
									<article className="grid grid-cols-2 gap-[var(--ak-panel-padding)]">
										<div className="grid content-start gap-4">
											<EditorSelectorControl
												value={merge.target}
												onChange={(target) =>
													update(index, {
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
													update(index, {
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
													update(
														index,
														effect === "replace"
															? {
																	...merge,
																	effect,
																	result:
																		merge.effect === "replace"
																			? merge.result
																			: "",
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
														update(index, {
															...merge,
															result,
														})
													}
												/>
											)}
										</div>
									</article>
								</EditorFormCard>
								<EditorFormSeparator />
								<EditorFormCard>
									<EditorOptionalOutputControl
										addLabel="Enable merge output"
										emptyDescription="The merge currently changes only its source and target. Enable an output to emit additional items when it resolves."
										emptyIcon="icon-[lucide--package-plus]"
										emptyTitle="No merge output"
										separated={false}
										value={merge.output}
										onChange={(output) =>
											update(index, {
												...merge,
												output,
											})
										}
									/>
								</EditorFormCard>
							</div>
						);
					}}
				</EditorCollectionSelector>
			)}
		</div>
	);
};
