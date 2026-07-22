import type { RuntimeItemSchema } from "~/engine/runtime/schema/RuntimeItemSchema";
import { ItemDetailTabEnumSchema } from "~/engine/item-detail/schema/ItemDetailTabEnumSchema";
import { isLineOwnerItem } from "~/engine/line/read/isLineOwnerItem";
import { ItemEnumSchema } from "~/engine/item/schema/ItemEnumSchema";

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
	const infoIndex = tabs.indexOf(ItemDetailTabEnumSchema.enum.Info);
	return infoIndex < 0
		? [
				...tabs,
				ItemDetailTabEnumSchema.enum.Sources,
			]
		: [
				...tabs.slice(0, infoIndex),
				ItemDetailTabEnumSchema.enum.Sources,
				...tabs.slice(infoIndex),
			];
};

const noTabs: readonly ItemDetailTabEnumSchema.Type[] = [];
const infoTab: readonly ItemDetailTabEnumSchema.Type[] = [
	ItemDetailTabEnumSchema.enum.Info,
];
const lineOwnerTabs: readonly ItemDetailTabEnumSchema.Type[] = [
	ItemDetailTabEnumSchema.enum.Lines,
	ItemDetailTabEnumSchema.enum.Info,
];
const queuedProducerTabs: readonly ItemDetailTabEnumSchema.Type[] = [
	ItemDetailTabEnumSchema.enum.Lines,
	ItemDetailTabEnumSchema.enum.Queue,
	ItemDetailTabEnumSchema.enum.Info,
];

/** Classifies the finite Item Detail tabs supported by one exact live runtime item. */
export const readItemDetailTabs = (
	item: RuntimeItemSchema.Type | undefined,
	sources?: ItemDetailSourcesAvailability,
): readonly ItemDetailTabEnumSchema.Type[] => {
	if (item === undefined) return noTabs;
	if (!isLineOwnerItem(item.item)) return withSources(infoTab, sources);
	return withSources(
		item.item.type === ItemEnumSchema.enum.Producer && item.item.maxQueueSize > 1
			? queuedProducerTabs
			: lineOwnerTabs,
		sources,
	);
};
