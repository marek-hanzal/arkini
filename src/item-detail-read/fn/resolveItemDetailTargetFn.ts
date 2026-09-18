import { Option } from "effect";

import type { IdSchema } from "~/game-value/schema/IdSchema";
import { ItemDetailTabEnumSchema } from "~/item-detail-read/schema/ItemDetailTabEnumSchema";
import type { RuntimeSchema } from "~/game-runtime/schema/RuntimeSchema";
import { narrowLineOwnerItemFn } from "~/production-line/fn/narrowLineOwnerItemFn";

export namespace resolveItemDetailTargetFn {
	export interface Props {
		readonly itemId: IdSchema.Type;
		readonly requestedTab?: ItemDetailTabEnumSchema.Type;
		readonly runtime: RuntimeSchema.Type;
	}

	export type Result =
		| {
				readonly kind: "available";
				readonly itemId: IdSchema.Type;
				readonly tab: ItemDetailTabEnumSchema.Type;
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
}: resolveItemDetailTargetFn.Props): resolveItemDetailTargetFn.Result => {
	const item = runtime.items.find((candidate) => candidate.id === itemId);
	if (item === undefined) return unavailable;
	const defaultTab = Option.isSome(narrowLineOwnerItemFn(item.item))
		? ItemDetailTabEnumSchema.enum.Lines
		: ItemDetailTabEnumSchema.enum.Info;
	return {
		kind: "available",
		itemId: item.id,
		tab: requestedTab ?? defaultTab,
	};
};
