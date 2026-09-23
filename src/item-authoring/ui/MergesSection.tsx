import { MergeOption } from "~/item-authoring/ui/MergeOption";
import { readCapabilityRelatedTermsFn } from "~/item-authoring/fn/readCapabilityRelatedTermsFn";
import { useTranslator } from "~/translation/ui/useTranslator";
import { Mx } from "~/translation/ui/Mx";
import { Combine } from "lucide-react";
import { useStore } from "@tanstack/react-form";

import type { MergeSchema } from "~/item-merge/schema/MergeSchema";
import { EditorCapabilityStatus } from "~/editor-control/ui/EditorCapabilityStatus";
import { EditorCollectionSelector } from "~/editor-control/ui/EditorCollectionSelector";
import { EditorFormSectionDivider } from "~/editor-control/ui/EditorFormSectionDivider";
import { MergeDraftDefault } from "~/item-authoring/ui/MergeDraftDefault";
import { MergeField } from "~/item-authoring/ui/MergeField";
import { useFormSession } from "~/item-authoring/ui/FormContext";
import { useEditorItemOptionLabel } from "~/authoring-form/ui/useEditorItemSearchOptions";
import type { GameConfigSchema } from "~/game-config/schema/GameConfigSchema";
import { useFormValidationFocusIndex } from "~/item-authoring/ui/useFormValidationIssues";

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
				<EditorCapabilityStatus
					actionLabel={translator.textFn("Enable")}
					icon={Combine}
					onEnableFn={() =>
						onChangeFn([
							structuredClone(MergeDraftDefault),
						])
					}
					title={translator.textFn("No merges for this item")}
					summary={translator.textFn("Item merges empty title")}
					size="large"
				/>
			) : (
				<>
					<EditorFormSectionDivider
						description={<Mx label="Item merges help" />}
						title={translator.textFn("Merges")}
					/>
					<EditorCollectionSelector
						count={merges.length}
						initialSelectedIndex={initialSelectedIndex}
						itemLabelFn={(index) => {
							const merge = merges[index];
							if (merge.action === "space")
								return `${translator.textFn("Space")} ${merge.space}`;
							const itemUid = merge.target.itemUid;
							return `${translator.textFn("Merge")} ${index + 1} — ${readItemLabelFn(
								itemUid,
								translator.textFn("No item selected"),
							)}`;
						}}
						renderItemContentFn={(index, label) => (
							<MergeOption
								label={label}
								merge={merges[index]}
								items={targetItems}
							/>
						)}
						itemSearchTermsFn={(index) => [
							"target" in merges[index]
								? merges[index].target.itemUid
								: String(merges[index].space),
							merges[index].action,
							merges[index].effect,
						]}
						itemRelatedSearchTermsFn={(index) =>
							readCapabilityRelatedTermsFn(merges[index], targetItems)
						}
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
						selectedIndex={invalidMergeIndex}
					>
						{(index) => (
							<MergeField
								merge={merges[index]}
								onChangeFn={(merge) => updateFn(index, merge)}
								sourceUnitsEnabled={sourceUnitsEnabled}
								targetUnitsEnabled={
									merges[index].action === "space"
										? sourceUnitsEnabled
										: targetItems[
													"target" in merges[index]
														? merges[index].target.itemUid
														: ""
												]?.uid === currentItemUid
											? sourceUnitsEnabled
											: targetItems[
													"target" in merges[index]
														? merges[index].target.itemUid
														: ""
												]?.units !== undefined
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
	const { canonicalItem, form, mergeIndex, project } = useFormSession();
	const sourceUnitsEnabled = useStore(form.store, (state) => state.values.units !== undefined);
	const merges = useStore(form.store, (state) => state.values.merge);
	const invalidMergeIndex = useFormValidationFocusIndex(merges);
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
