import { useCallback } from "react";

import { EditorItemReferenceControl } from "~/authoring-form/ui/EditorItemAutocompleteField";
import { EditorAssetReferenceControl } from "~/authoring-form/ui/AssetAutocompleteField";
import { useEditorProject } from "~/authoring-session/ui/useEditorProject";
import type { ItemSchema } from "~/item-definition/schema/ItemSchema";
import type { Project } from "~/project-authoring/type/Project";

/** Adds note relationships immediately; selected links are rendered below both pickers. */
export const NoteLinkPickers = ({
	itemUids,
	resourceIds,
	disabled,
	onItemUidsChangeFn,
	onResourceIdsChangeFn,
}: {
	readonly itemUids: ReadonlyArray<string>;
	readonly resourceIds: ReadonlyArray<string>;
	readonly disabled: boolean;
	readonly onItemUidsChangeFn: (itemUids: ReadonlyArray<string>) => void;
	readonly onResourceIdsChangeFn: (resourceIds: ReadonlyArray<string>) => void;
}) => {
	const project = useEditorProject();
	const includeItemFn = useCallback(
		(item: ItemSchema.Type) => !itemUids.includes(item.uid),
		[
			itemUids,
		],
	);
	const includeResourceFn = useCallback(
		(resource: Project.Resource) => !resourceIds.includes(resource.id),
		[
			resourceIds,
		],
	);
	return (
		<fieldset
			className="grid min-w-0 gap-3"
			disabled={disabled}
			data-ui="EditorNoteLinkPickers"
		>
			{/* A selection settles each picker; begin a fresh search after changing links. */}
			<EditorItemReferenceControl
				showSelectedPreview={false}
				key={`items:${itemUids.length}`}
				label="Link item"
				value=""
				includeItemFn={includeItemFn}
				onChangeFn={(itemId) => {
					const item = project.config.items[itemId];
					if (disabled || item === undefined || itemUids.includes(item.uid)) return;
					onItemUidsChangeFn([
						...itemUids,
						item.uid,
					]);
				}}
			/>
			<EditorAssetReferenceControl
				showSelectedPreview={false}
				key={`assets:${resourceIds.length}`}
				label="Link asset"
				value=""
				includeResourceFn={includeResourceFn}
				onChangeFn={(resourceId) => {
					if (
						disabled ||
						resourceIds.includes(resourceId) ||
						!project.resources.some((resource) => resource.id === resourceId)
					)
						return;
					onResourceIdsChangeFn([
						...resourceIds,
						resourceId,
					]);
				}}
			/>
		</fieldset>
	);
};
