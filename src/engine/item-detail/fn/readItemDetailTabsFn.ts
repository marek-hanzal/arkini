import { Option } from "effect";

import type { RuntimeItemSchema } from "~/engine/runtime/schema/RuntimeItemSchema";
import { ItemDetailTabEnumSchema } from "~/engine/item-detail/schema/ItemDetailTabEnumSchema";
import { isLineOwnerItemFn } from "~/production-line/fn/isLineOwnerItemFn";

type ItemDetailTabsTarget =
	| {
			readonly kind: "runtime";
			readonly item: RuntimeItemSchema.Type | undefined;
	  }
	| {
			readonly kind: "definition";
	  };

export namespace readItemDetailTabsFn {
	export type SourcesAvailability =
		| {
				readonly kind: "available";
				readonly source: readonly unknown[];
		  }
		| {
				readonly kind: "unavailable";
		  };

	export interface Props {
		readonly target: ItemDetailTabsTarget;
		readonly sources?: SourcesAvailability;
	}
}

const withSources = (
	tabs: readonly ItemDetailTabEnumSchema.Type[],
	sources: readItemDetailTabsFn.SourcesAvailability | undefined,
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
	ItemDetailTabEnumSchema.enum.Queue,
	ItemDetailTabEnumSchema.enum.Info,
];

/** Classifies the finite Item Detail tabs supported by one exact runtime or definition target. */
export const readItemDetailTabsFn = ({ sources, target }: readItemDetailTabsFn.Props) => {
	if (target.kind === "definition") return withSources(infoTab, sources);
	if (target.item === undefined) return noTabs;
	const lineOwnerItem = Option.getOrUndefined(isLineOwnerItemFn(target.item.item));
	if (lineOwnerItem === undefined) return withSources(infoTab, sources);
	return withSources(lineOwnerTabs, sources);
};
