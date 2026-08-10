import type { PropsWithChildren } from "react";

import type { EditorItemType } from "~/bridge/item/editor/EditorItemModel";
import { useEditorItemDraft } from "~/bridge/item/editor/useEditorItemDraft";
import { convertEditorItemFx } from "~/bridge/item/editor/convertEditorItemFx";
import { RendererRuntime } from "~/bridge/runtime/RendererRuntime";
import { EditorItemFormSession } from "~/ui/item/editor/EditorItemFormSession";
import { EditorItemNotFound } from "~/ui/item/editor/EditorItemNotFound";
import type {
	EditorItemOptionalCapability,
	EditorItemSectionId,
} from "~/ui/item/editor/EditorItemSections";
import { useEditorItemByUid } from "~/ui/item/editor/useEditorItemByUid";

export namespace EditorItemForm {
	export interface Props extends PropsWithChildren {
		readonly enableCapability?: EditorItemOptionalCapability;
		readonly itemType?: EditorItemType;
		readonly sectionId?: EditorItemSectionId;
		readonly uid: string;
	}
}

/** Resolves a canonical item by UID or seeds its first local form from itemType. */
export const EditorItemForm = ({
	children,
	enableCapability,
	itemType,
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
				: RendererRuntime.runSync(convertEditorItemFx(persistedItem, itemType));
	const isNew = persistedItem === undefined;
	return (
		<EditorItemFormSession
			key={`${initialItem.uid}:${initialItem.type}`}
			enableCapability={enableCapability}
			initialItem={initialItem}
			isNew={isNew}
			itemType={itemType}
			sectionId={sectionId}
		>
			{children}
		</EditorItemFormSession>
	);
};
