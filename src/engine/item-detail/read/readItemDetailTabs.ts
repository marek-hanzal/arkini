import type { RuntimeItemSchema } from "~/engine/runtime/schema/RuntimeItemSchema";
import type { ItemDetailTabEnumSchema } from "~/engine/item-detail/schema/ItemDetailTabEnumSchema";
import { isLineOwnerItem } from "~/engine/line/read/isLineOwnerItem";

type ItemDetailSourcesAvailability =
	| {
			readonly kind: "available";
			readonly source: readonly unknown[];
	  }
	| {
			readonly kind: "unavailable";
	  };

const withSources = (
	tabs: readonly ItemDetailTabEnumSchema.Type[],
	sources: ItemDetailSourcesAvailability | undefined,
): readonly ItemDetailTabEnumSchema.Type[] => {
	if (sources?.kind !== "available" || sources.source?.length === 0) return tabs;
	const infoIndex = tabs.indexOf("info");
	return infoIndex < 0
		? [
				...tabs,
				"sources",
			]
		: [
				...tabs.slice(0, infoIndex),
				"sources",
				...tabs.slice(infoIndex),
			];
};

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
	sources?: ItemDetailSourcesAvailability,
): readonly ItemDetailTabEnumSchema.Type[] => {
	if (item === undefined) return noTabs;
	if (!isLineOwnerItem(item.item)) return withSources(infoTab, sources);
	return withSources(
		item.item.type === "producer" && item.item.maxQueueSize > 1
			? queuedProducerTabs
			: lineOwnerTabs,
		sources,
	);
};
