import type { TypeSchema } from "~/engine/item/schema/TypeSchema";
import type { PropsWithChildren } from "react";
import { useEditorItemDraft } from "~/ui/item/editor/useEditorItemDraft";
import { convertEditorItemFx } from "~/editor/item/fx/convertEditorItemFx";
import { RendererRuntime } from "~/renderer/RendererRuntime";
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
				: RendererRuntime.runSync(convertEditorItemFx(persistedItem, itemType));
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
