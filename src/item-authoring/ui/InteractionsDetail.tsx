import type { ItemSchema } from "~/item-definition/schema/ItemSchema";
import { ActionDetail } from "~/item-authoring/ui/ActionDetail";
import { MergesDetail } from "~/item-authoring/ui/CapabilityDetails";
import { ItemDetailSectionHeader } from "~/item-authoring/ui/ItemDetailSectionHeader";
import { useTranslator } from "~/translation/ui/useTranslator";

/** Presents click and drop interactions together while preserving separate authoring. */
export const InteractionsDetail = ({ item }: { readonly item: ItemSchema.Type }) => {
	const translator = useTranslator();
	return (
		<div
			className="grid gap-[var(--ak-viewport-gap)]"
			data-ui="EditorItemInteractionsDetail"
		>
			<ItemDetailSectionHeader
				itemUid={item.uid}
				sectionId="action"
				title={translator.textFn("Action")}
				description={translator.textFn(
					"Clicking this item can enter a space or open Inventory after its requirements pass.",
				)}
			/>
			<ActionDetail item={item} />
			<ItemDetailSectionHeader
				itemUid={item.uid}
				sectionId="merges"
				title={translator.textFn("Merges")}
				description={translator.textFn(
					"Dropping this item onto a matching target applies its source action, target effect and optional output.",
				)}
			/>
			<MergesDetail item={item} />
		</div>
	);
};
