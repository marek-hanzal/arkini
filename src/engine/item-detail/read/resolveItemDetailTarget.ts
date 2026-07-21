import type { IdSchema } from "~/engine/common/schema/IdSchema";
import { readItemDetailTabs } from "~/engine/item-detail/read/readItemDetailTabs";
import type { readItemDetailSourcesFx } from "~/engine/item-detail/read/readItemDetailSourcesFx";
import type { ItemDetailTabEnumSchema } from "~/engine/item-detail/schema/ItemDetailTabEnumSchema";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";

export namespace resolveItemDetailTarget {
	export interface Props {
		readonly itemId: IdSchema.Type;
		readonly requestedTab?: ItemDetailTabEnumSchema.Type;
		readonly runtime: RuntimeSchema.Type;
		readonly sources?: readItemDetailSourcesFx.Result;
	}

	export type Result =
		| {
				readonly kind: "available";
				readonly itemId: IdSchema.Type;
				readonly tab: ItemDetailTabEnumSchema.Type;
				readonly tabs: readonly ItemDetailTabEnumSchema.Type[];
		  }
		| {
				readonly kind: "unavailable";
		  };
}

const unavailable = {
	kind: "unavailable",
} as const satisfies resolveItemDetailTarget.Result;

/** Validates one exact Item Detail target and deterministically resolves its active tab. */
export const resolveItemDetailTarget = ({
	itemId,
	requestedTab,
	runtime,
	sources,
}: resolveItemDetailTarget.Props): resolveItemDetailTarget.Result => {
	const item = runtime.items.find((candidate) => candidate.id === itemId);
	const tabs = readItemDetailTabs(item, sources);
	if (item === undefined || tabs.length === 0) return unavailable;
	const defaultTab = tabs[0];
	const fallback =
		requestedTab === undefined ? defaultTab : tabs.includes("info") ? "info" : defaultTab;
	if (fallback === undefined) return unavailable;
	return {
		kind: "available",
		itemId: item.id,
		tab: requestedTab !== undefined && tabs.includes(requestedTab) ? requestedTab : fallback,
		tabs,
	};
};
