import { useTranslator } from "~/translation/ui/useTranslator";
import { Combine } from "lucide-react";
import { useStore } from "@tanstack/react-form";

import type { MergeSchema } from "~/item-merge/schema/MergeSchema";
import { EditorCapabilityStatus } from "~/editor-control/ui/EditorCapabilityStatus";
import { EditorCollectionSelector } from "~/editor-control/ui/EditorCollectionSelector";
import { EditorFormCard } from "~/editor-control/ui/EditorFormCard";
import { MergeDraftDefault } from "~/item-authoring/ui/MergeDraftDefault";
import { MergeField } from "~/item-authoring/ui/MergeField";
import { useFormSession } from "~/item-authoring/ui/FormContext";
import { useEditorItemOptionLabel } from "~/authoring-form/ui/useEditorItemSearchOptions";
import type { GameConfigSchema } from "~/game-config/schema/GameConfigSchema";

const MergeFields = ({
	currentItemUid,
	initialSelectedIndex,
	invalidMergeIndex,
	onChangeFn,
	sourceUnitsEnabled,
	targetItems,
	value,
}: {
	readonly currentItemUid: string;
	readonly initialSelectedIndex: number;
	readonly invalidMergeIndex?: number;
	readonly onChangeFn: (value: MergeSchema.Type[] | undefined) => void;
	readonly sourceUnitsEnabled: boolean;
	readonly targetItems: GameConfigSchema.Type["items"];
	readonly value: MergeSchema.Type[] | undefined;
}) => {
	const translator = useTranslator();
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
						actionLabel={translator.textFn("Enable merges")}
						description={translator.textFn(
							"Merges let dropping this item onto a matching target consume or retain the source, change the target and optionally emit an output.",
						)}
						icon={Combine}
						onEnableFn={() =>
							onChangeFn([
								structuredClone(MergeDraftDefault),
							])
						}
						title={translator.textFn("Merges are disabled")}
					/>
				</EditorFormCard>
			) : (
				<>
					<EditorCollectionSelector
						addLabel={translator.textFn("Add merge")}
						count={merges.length}
						initialSelectedIndex={initialSelectedIndex}
						itemLabelFn={(index) => {
							const itemId = merges[index].target.itemId;
							return `${translator.textFn("Merge")} ${index + 1} — ${readItemLabelFn(
								itemId,
								translator.textFn("No item selected"),
							)}`;
						}}
						itemSearchTermsFn={(index) => [
							merges[index].target.itemId,
						]}
						label={translator.textFn("Merges")}
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
						removeLabel={translator.textFn("Remove merge")}
						selectedIndex={invalidMergeIndex}
					>
						{(index) => (
							<MergeField
								merge={merges[index]}
								onChangeFn={(merge) => updateFn(index, merge)}
								sourceUnitsEnabled={sourceUnitsEnabled}
								targetUnitsEnabled={
									targetItems[merges[index].target.itemId]?.uid === currentItemUid
										? sourceUnitsEnabled
										: targetItems[merges[index].target.itemId]?.units !==
											undefined
								}
							/>
						)}
					</EditorCollectionSelector>
				</>
			)}
		</div>
	);
};

export const MergesSection = () => {
	const { canonicalItem, form, mergeIndex, project, validationIssues } = useFormSession();
	const sourceUnitsEnabled = useStore(form.store, (state) => state.values.units !== undefined);
	const invalidMergeIndex = validationIssues.find(
		(issue) => issue.path[0] === "merge" && typeof issue.path[1] === "number",
	)?.path[1] as number | undefined;
	return (
		<form.Subscribe selector={(state) => state.values.merge}>
			{(merge) => (
				<MergeFields
					currentItemUid={canonicalItem.uid}
					initialSelectedIndex={mergeIndex ?? 0}
					invalidMergeIndex={invalidMergeIndex}
					sourceUnitsEnabled={sourceUnitsEnabled}
					targetItems={project.config.items}
					value={merge}
					onChangeFn={(next) => form.setFieldValue("merge", next)}
				/>
			)}
		</form.Subscribe>
	);
};
