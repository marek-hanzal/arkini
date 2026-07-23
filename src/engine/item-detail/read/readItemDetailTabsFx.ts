import { Effect } from "effect";

import type { RuntimeItemSchema } from "~/engine/runtime/schema/RuntimeItemSchema";
import { ItemDetailTabEnumSchema } from "~/engine/item-detail/schema/ItemDetailTabEnumSchema";
import { isLineOwnerItem } from "~/engine/line/read/isLineOwnerItem";
import { ItemEnumSchema } from "~/engine/item/schema/ItemEnumSchema";

export namespace readItemDetailTabsFx {
	export type SourcesAvailability =
		| {
				readonly kind: "available";
				readonly source: readonly unknown[];
		  }
		| {
				readonly kind: "unavailable";
		  };

	export type Target =
		| {
				readonly kind: "runtime";
				readonly item: RuntimeItemSchema.Type | undefined;
		  }
		| {
				readonly kind: "definition";
		  };

	export interface Props {
		readonly target: Target;
		readonly sources?: SourcesAvailability;
	}
}

const withSources = (
	tabs: readonly ItemDetailTabEnumSchema.Type[],
	sources: readItemDetailTabsFx.SourcesAvailability | undefined,
): readonly ItemDetailTabEnumSchema.Type[] => {
	if (sources?.kind !== "available" || sources.source?.length === 0) return tabs;
	const infoIndex = tabs.indexOf(ItemDetailTabEnumSchema.enum.Info);
	return infoIndex < 0
		? [
				...tabs,
				ItemDetailTabEnumSchema.enum.Sources,
			]
		: [
				...tabs.slice(0, infoIndex + 1),
				ItemDetailTabEnumSchema.enum.Sources,
				...tabs.slice(infoIndex + 1),
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

/** Classifies the finite Item Detail tabs supported by one exact runtime or definition target. */
export const readItemDetailTabsFx = Effect.fn("readItemDetailTabsFx")(function* ({
	sources,
	target,
}: readItemDetailTabsFx.Props) {
	if (target.kind === "definition") return withSources(infoTab, sources);
	if (target.item === undefined) return noTabs;
	if (!isLineOwnerItem(target.item.item)) return withSources(infoTab, sources);
	return withSources(
		target.item.item.type === ItemEnumSchema.enum.Producer && target.item.item.maxQueueSize > 1
			? queuedProducerTabs
			: lineOwnerTabs,
		sources,
	);
});
