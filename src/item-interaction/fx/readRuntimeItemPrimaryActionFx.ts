import { Effect, Option } from "effect";

import { resolveJobQueueFx } from "~/production-job/fx/resolveJobQueueFx";
import { narrowLineOwnerItemFn } from "~/production-line/fn/narrowLineOwnerItemFn";
import { readEffectiveLineFn } from "~/production-line/fn/readEffectiveLineFn";
import type { RuntimeItemSchema } from "~/game-runtime/schema/RuntimeItemSchema";
import type { RuntimeSchema } from "~/game-runtime/schema/RuntimeSchema";

export namespace readRuntimeItemPrimaryActionFx {
	export type Result =
		| {
				readonly kind: "none";
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
		const lineOwnerItem = Option.getOrUndefined(narrowLineOwnerItemFn(item.item));
		if (lineOwnerItem === undefined) {
			return {
				kind: "none" as const,
			} satisfies readRuntimeItemPrimaryActionFx.Result;
		}
		const defaultLine = readEffectiveLineFn({
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
