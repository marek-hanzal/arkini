import type { RuntimeItemSchema } from "~/engine/runtime/schema/RuntimeItemSchema";
import type { ItemDetailTabEnumSchema } from "~/engine/item-detail/schema/ItemDetailTabEnumSchema";
import { isLineOwnerItem } from "~/engine/line/read/isLineOwnerItem";

const noTabs: readonly ItemDetailTabEnumSchema.Type[] = [];
const infoTab: readonly ItemDetailTabEnumSchema.Type[] = [
	"info",
];
const lineOwnerTabs: readonly ItemDetailTabEnumSchema.Type[] = [
	"lines",
	"info",
];
const queuedProducerTabs: readonly ItemDetailTabEnumSchema.Type[] = [
	"lines",
	"queue",
	"info",
];

/** Classifies the finite Item Detail tabs supported by one exact live runtime item. */
export const readItemDetailTabs = (
	item: RuntimeItemSchema.Type | undefined,
): readonly ItemDetailTabEnumSchema.Type[] => {
	if (item === undefined) return noTabs;
	if (!isLineOwnerItem(item.item)) return infoTab;
	return item.item.type === "producer" && item.item.maxQueueSize > 1
		? queuedProducerTabs
		: lineOwnerTabs;
};
