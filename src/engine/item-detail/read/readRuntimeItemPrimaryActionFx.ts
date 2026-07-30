import { Effect, Option } from "effect";

import { ItemEnumSchema } from "~/engine/item/schema/ItemEnumSchema";
import { resolveJobQueueFx } from "~/engine/job/fx/read/resolveJobQueueFx";
import { isLineOwnerItemFx } from "~/engine/line/read/isLineOwnerItemFx";
import { readEffectiveDefaultLineFx } from "~/engine/line/read/readEffectiveDefaultLineFx";
import type { RuntimeItemSchema } from "~/engine/runtime/schema/RuntimeItemSchema";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";

export namespace readRuntimeItemPrimaryActionFx {
	export type Result =
		| {
				readonly kind: "none";
		  }
		| {
				readonly kind: "open-inventory";
		  }
		| {
				readonly kind: "enqueue-default-line";
				readonly lineId: string;
				readonly queue: {
					readonly available: boolean;
					readonly capacity: number;
					readonly used: number;
				};
		  };

	export interface Props {
		readonly item: RuntimeItemSchema.Type;
		readonly runtime: RuntimeSchema.Type;
	}
}

/** Resolves the canonical single-click action of one exact live item. */
export const readRuntimeItemPrimaryActionFx = Effect.fn("readRuntimeItemPrimaryActionFx")(
	function* ({ item, runtime }: readRuntimeItemPrimaryActionFx.Props) {
		if (item.item.type === ItemEnumSchema.enum.Inventory) {
			return {
				kind: "open-inventory" as const,
			} satisfies readRuntimeItemPrimaryActionFx.Result;
		}
		const lineOwnerItem = Option.getOrUndefined(yield* isLineOwnerItemFx(item.item));
		if (lineOwnerItem === undefined) {
			return {
				kind: "none" as const,
			} satisfies readRuntimeItemPrimaryActionFx.Result;
		}
		const defaultLine = yield* readEffectiveDefaultLineFx({
			ownerItemId: item.id,
			ownerItem: lineOwnerItem,
			runtime,
		});
		if (defaultLine !== undefined) {
			const queue = yield* resolveJobQueueFx({
				owner: item,
				runtime,
			});
			return {
				kind: "enqueue-default-line" as const,
				lineId: defaultLine.id,
				queue: {
					available: queue.available,
					capacity: queue.capacity,
					used: queue.used,
				},
			} satisfies readRuntimeItemPrimaryActionFx.Result;
		}
		return {
			kind: "none" as const,
		} satisfies readRuntimeItemPrimaryActionFx.Result;
	},
);
