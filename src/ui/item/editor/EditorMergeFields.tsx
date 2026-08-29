import { Combine } from "lucide-react";

import type { MergeSchema } from "~/engine/merge/schema/MergeSchema";
import { EditorCapabilityStatus } from "~/ui/form/EditorCapabilityStatus";
import { EditorCollectionSelector } from "~/ui/form/EditorCollectionSelector";
import { EditorFormCard } from "~/ui/form/EditorFormCard";
import { EditorFormSectionDivider } from "~/ui/form/EditorFormSectionDivider";
import { EditorItemDraftDefaults } from "~/ui/item/editor/EditorItemDraftDefaults";
import { EditorMergeField } from "~/ui/item/editor/EditorMergeField";
import { useEditorItemOptionLabel } from "~/ui/item/editor/useEditorItemOptionLabel";

/** Edits the optional non-empty merge array without coupling it to one form API. */
export const EditorMergeFields = ({
	onChange,
	value,
}: {
	readonly onChange: (value: MergeSchema.Type[] | undefined) => void;
	readonly value: MergeSchema.Type[] | undefined;
}) => {
	const readItemLabel = useEditorItemOptionLabel();
	const merges = value ?? [];
	const update = (index: number, merge: MergeSchema.Type) => {
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
						icon={Combine}
						onEnable={() =>
							onChange([
								structuredClone(EditorItemDraftDefaults.merge),
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
						{(index) => (
							<EditorMergeField
								merge={merges[index]}
								onChange={(merge) => update(index, merge)}
							/>
						)}
					</EditorCollectionSelector>
				</>
			)}
		</div>
	);
};
