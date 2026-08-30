import type { IdSchema } from "~/engine/common/schema/IdSchema";
import { readItemDetailTabsFn } from "~/item-detail-read/fn/readItemDetailTabsFn";
import type { readItemDetailSourcesFx } from "~/item-detail-read/fx/readItemDetailSourcesFx";
import { ItemDetailTabEnumSchema } from "~/item-detail-read/schema/ItemDetailTabEnumSchema";
import type { RuntimeSchema } from "~/game-runtime/schema/RuntimeSchema";

export namespace resolveItemDetailTargetFn {
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
} as const satisfies resolveItemDetailTargetFn.Result;

/** Validates one exact Item Detail target and deterministically resolves its active tab. */
export const resolveItemDetailTargetFn = ({
	itemId,
	requestedTab,
	runtime,
	sources,
}: resolveItemDetailTargetFn.Props): resolveItemDetailTargetFn.Result => {
	const item = runtime.items.find((candidate) => candidate.id === itemId);
	const tabs = readItemDetailTabsFn({
		target: {
			kind: "runtime",
			item,
		},
		sources,
	});
	if (item === undefined || tabs.length === 0) return unavailable;
	const defaultTab = tabs.includes(ItemDetailTabEnumSchema.enum.Lines)
		? ItemDetailTabEnumSchema.enum.Lines
		: tabs[0];
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
	};
};
