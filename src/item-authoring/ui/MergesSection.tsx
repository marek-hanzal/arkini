import { Combine } from "lucide-react";

import type { MergeSchema } from "~/item-merge/schema/MergeSchema";
import { EditorCapabilityStatus } from "~/editor-control/ui/EditorCapabilityStatus";
import { EditorCollectionSelector } from "~/editor-control/ui/EditorCollectionSelector";
import { EditorFormCard } from "~/editor-control/ui/EditorFormCard";
import { EditorFormSectionDivider } from "~/editor-control/ui/EditorFormSectionDivider";
import { MergeDraftDefault } from "~/item-authoring/ui/MergeDraftDefault";
import { MergeField } from "~/item-authoring/ui/MergeField";
import { useFormSession } from "~/item-authoring/ui/FormContext";
import { useEditorItemOptionLabel } from "~/authoring-form/ui/useEditorItemSearchOptions";

const MergeFields = ({
	initialSelectedIndex,
	onChangeFn,
	value,
}: {
	readonly initialSelectedIndex: number;
	readonly onChangeFn: (value: MergeSchema.Type[] | undefined) => void;
	readonly value: MergeSchema.Type[] | undefined;
}) => {
	const readItemLabelFn = useEditorItemOptionLabel();
	const merges = value ?? [];
	const updateFn = (index: number, merge: MergeSchema.Type) => {
		const next = [
			...merges,
		];
		next[index] = merge;
		onChangeFn(next);
	};
	return (
		<div className="grid gap-[var(--ak-viewport-gap)]">
			{merges.length === 0 ? (
				<EditorFormCard>
					<EditorCapabilityStatus
						actionLabel="Enable merges"
						description="Merges let dropping this item onto a matching target consume or retain the source, change the target and optionally emit an output."
						icon={Combine}
						onEnableFn={() =>
							onChangeFn([
								structuredClone(MergeDraftDefault),
							])
						}
						title="Merges are disabled"
					/>
				</EditorFormCard>
			) : (
				<>
					<EditorFormSectionDivider
						description="Interactions triggered when this item is dropped onto a matching target."
						title="Merges"
					/>
					<EditorCollectionSelector
						addLabel="Add merge"
						count={merges.length}
						initialSelectedIndex={initialSelectedIndex}
						itemLabelFn={(index) => {
							const itemId = merges[index].target.itemId;
							return readItemLabelFn(itemId, `Merge ${index + 1}`);
						}}
						label="Merges"
						key={initialSelectedIndex}
						navigationCard
						onAddFn={() =>
							onChangeFn([
								...merges,
								structuredClone(MergeDraftDefault),
							])
						}
						onRemoveFn={(index) => {
							const next = merges.filter((_merge, candidate) => candidate !== index);
							onChangeFn(next.length === 0 ? undefined : next);
						}}
						removeLabel="Remove merge"
					>
						{(index) => (
							<MergeField
								merge={merges[index]}
								onChangeFn={(merge) => updateFn(index, merge)}
							/>
						)}
					</EditorCollectionSelector>
				</>
			)}
		</div>
	);
};

export const MergesSection = () => {
	const { form, mergeIndex } = useFormSession();
	return (
		<form.Subscribe selector={(state) => state.values.merge}>
			{(merge) => (
				<MergeFields
					initialSelectedIndex={mergeIndex ?? 0}
					value={merge}
					onChangeFn={(next) => form.setFieldValue("merge", next)}
				/>
			)}
		</form.Subscribe>
	);
};
