import { Effect, Option } from "effect";

import { TypeSchema } from "~/item-definition/schema/TypeSchema";
import { resolveJobQueueFx } from "~/production-job/fx/read/resolveJobQueueFx";
import { isLineOwnerItemFn } from "~/production-line/fn/isLineOwnerItemFn";
import { readEffectiveDefaultLineFn } from "~/production-line/fn/readEffectiveDefaultLineFn";
import type { RuntimeItemSchema } from "~/game-runtime/schema/RuntimeItemSchema";
import type { RuntimeSchema } from "~/game-runtime/schema/RuntimeSchema";

export namespace readRuntimeItemPrimaryActionFx {
	export type Result =
		| {
				readonly kind: "none";
		  }
		| {
				readonly currentSpace: number;
				readonly kind: "activate-space";
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

/** Resolves the canonical single-click interaction of one exact live item. */
export const readRuntimeItemPrimaryActionFx = Effect.fn("readRuntimeItemPrimaryActionFx")(
	function* ({ item, runtime }: readRuntimeItemPrimaryActionFx.Props) {
		if (item.item.type === TypeSchema.enum.Space) {
			return {
				currentSpace: runtime.currentSpace,
				kind: "activate-space" as const,
			} satisfies readRuntimeItemPrimaryActionFx.Result;
		}
		if (item.item.type === TypeSchema.enum.Inventory) {
			return {
				kind: "open-inventory" as const,
			} satisfies readRuntimeItemPrimaryActionFx.Result;
		}
		const lineOwnerItem = Option.getOrUndefined(isLineOwnerItemFn(item.item));
		if (lineOwnerItem === undefined) {
			return {
				kind: "none" as const,
			} satisfies readRuntimeItemPrimaryActionFx.Result;
		}
		const defaultLine = readEffectiveDefaultLineFn({
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
