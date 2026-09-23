import { useTranslator } from "~/translation/ui/useTranslator";
import { useCallback } from "react";

import { EditorItemReferenceControl } from "~/authoring-form/ui/EditorItemAutocompleteField";
import { ResourceReferenceControl } from "~/authoring-form/ui/ResourceAutocompleteField";
import { useEditorProject } from "~/authoring-session/ui/useEditorProject";
import type { ItemSchema } from "~/item-definition/schema/ItemSchema";
import type { Project } from "~/project-authoring/type/Project";

/** Adds note relationships immediately; selected links are rendered below both pickers. */
export const NoteLinkPickers = ({
	itemUids,
	resourceUids,
	disabled,
	onItemUidsChangeFn,
	onResourceUidsChangeFn,
}: {
	readonly itemUids: ReadonlyArray<string>;
	readonly resourceUids: ReadonlyArray<string>;
	readonly disabled: boolean;
	readonly onItemUidsChangeFn: (itemUids: ReadonlyArray<string>) => void;
	readonly onResourceUidsChangeFn: (resourceUids: ReadonlyArray<string>) => void;
}) => {
	const translator = useTranslator();
	const project = useEditorProject();
	const includeItemFn = useCallback(
		(item: ItemSchema.Type) => !itemUids.includes(item.uid),
		[
			itemUids,
		],
	);
	const includeResourceFn = useCallback(
		(resource: Project.Resource) => !resourceUids.includes(resource.uid),
		[
			resourceUids,
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
				label={translator.textFn("Link item")}
				value=""
				includeItemFn={includeItemFn}
				onChangeFn={(itemUid) => {
					const item = project.config.items[itemUid];
					if (disabled || item === undefined || itemUids.includes(item.uid)) return;
					onItemUidsChangeFn([
						...itemUids,
						item.uid,
					]);
				}}
			/>
			<ResourceReferenceControl
				showSelectedPreview={false}
				emptyLabel={translator.textFn("No resources match this search.")}
				key={`resources:${resourceUids.length}`}
				label={translator.textFn("Link resource")}
				value=""
				includeResourceFn={includeResourceFn}
				onChangeFn={(resourceUid) => {
					if (
						disabled ||
						resourceUids.includes(resourceUid) ||
						!project.resources.some((resource) => resource.uid === resourceUid)
					)
						return;
					onResourceUidsChangeFn([
						...resourceUids,
						resourceUid,
					]);
				}}
			/>
		</fieldset>
	);
};
