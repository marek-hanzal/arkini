import type { ItemSchema } from "~/item-definition/schema/ItemSchema";
import type { TypeSchema } from "~/item-definition/schema/TypeSchema";
import { useMemo, type PropsWithChildren } from "react";
import { createEditorItemDraftFn } from "~/item-authoring/fn/createEditorItemDraftFn";
import { convertEditorItemFn } from "~/item-authoring/fn/convertEditorItemFn";
import { EditorItemFormSession } from "~/item-authoring/ui/EditorItemFormSession";
import { EditorItemNotFound } from "~/item-authoring/ui/EditorItemNotFound";
import type {
	EditorItemOptionalCapability,
	EditorItemSectionId,
} from "~/item-authoring/type/EditorItemSection";
import { useEditorProject } from "~/authoring-session/ui/useEditorProject";
import { useEditorItemByUid } from "~/item-authoring/ui/useEditorItemByUid";

const useEditorItemDraft = (type: TypeSchema.Type, uid: string): ItemSchema.Type => {
	const project = useEditorProject();
	return useMemo(
		() =>
			createEditorItemDraftFn({
				resourceId: project.resources[0]?.id ?? "missing-asset",
				type,
				uid,
			}),
		[
			project.resources,
			type,
			uid,
		],
	);
};

export namespace EditorItemForm {
	export interface Props extends PropsWithChildren {
		readonly enableCapability?: EditorItemOptionalCapability;
		readonly itemType?: TypeSchema.Type;
		readonly productionLineId?: string;
		readonly sectionId?: EditorItemSectionId;
		readonly uid: string;
	}
}

/** Resolves a canonical item by UID or seeds its first local form from itemType. */
export const EditorItemForm = ({
	children,
	enableCapability,
	itemType,
	productionLineId,
	sectionId = "identity",
	uid,
}: EditorItemForm.Props) => {
	const persistedItem = useEditorItemByUid(uid);
	const draft = useEditorItemDraft(itemType ?? persistedItem?.type ?? "simple", uid);
	if (persistedItem === undefined && itemType === undefined)
		return <EditorItemNotFound uid={uid} />;
	const initialItem =
		persistedItem === undefined
			? draft
			: itemType === undefined
				? persistedItem
				: convertEditorItemFn(persistedItem, itemType);
	const isNew = persistedItem === undefined;
	return (
		<EditorItemFormSession
			key={`${initialItem.uid}:${initialItem.type}`}
			enableCapability={enableCapability}
			initialItem={initialItem}
			isNew={isNew}
			itemType={itemType}
			productionLineId={productionLineId}
			sectionId={sectionId}
		>
			{children}
		</EditorItemFormSession>
	);
};
