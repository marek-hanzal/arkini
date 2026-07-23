import { Effect } from "effect";

import type { IdSchema } from "~/engine/common/schema/IdSchema";
import { readItemDetailTabsFx } from "~/engine/item-detail/read/readItemDetailTabsFx";
import type { readItemDetailSourcesFx } from "~/engine/item-detail/read/readItemDetailSourcesFx";
import { ItemDetailTabEnumSchema } from "~/engine/item-detail/schema/ItemDetailTabEnumSchema";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";

export namespace resolveItemDetailTargetFx {
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
} as const satisfies resolveItemDetailTargetFx.Result;

/** Validates one exact Item Detail target and deterministically resolves its active tab. */
export const resolveItemDetailTargetFx = Effect.fn("resolveItemDetailTargetFx")(function* ({
	itemId,
	requestedTab,
	runtime,
	sources,
}: resolveItemDetailTargetFx.Props) {
	const item = runtime.items.find((candidate) => candidate.id === itemId);
	const tabs = yield* readItemDetailTabsFx({
		target: {
			kind: "runtime",
			item,
		},
		sources,
	});
	if (item === undefined || tabs.length === 0) return unavailable;
	const defaultTab = tabs[0];
	const fallback =
		requestedTab === undefined
			? defaultTab
			: tabs.includes(ItemDetailTabEnumSchema.enum.Info)
				? ItemDetailTabEnumSchema.enum.Info
				: defaultTab;
	if (fallback === undefined) return unavailable;
	return {
		kind: "available",
		itemId: item.id,
		tab: requestedTab !== undefined && tabs.includes(requestedTab) ? requestedTab : fallback,
		tabs,
	} satisfies resolveItemDetailTargetFx.Result;
});
