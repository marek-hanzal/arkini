import { Effect, Option, Result } from "effect";

import { resolveJobQueueFx } from "~/production-job/fx/resolveJobQueueFx";
import { narrowLineOwnerItemFn } from "~/production-line/fn/narrowLineOwnerItemFn";
import { readEffectiveLineFn } from "~/production-line/fn/readEffectiveLineFn";
import { isLineAdmissionOpenFn } from "~/production-line/fn/isLineAdmissionOpenFn";
import { resolveLineStartFx } from "~/production-job/fx/resolveLineStartFx";
import { assertLineEnqueueConditionsFx } from "~/production-job/fx/assertLineEnqueueConditionsFx";
import type { RuntimeItemSchema } from "~/game-runtime/schema/RuntimeItemSchema";
import type { RuntimeSchema } from "~/game-runtime/schema/RuntimeSchema";

export namespace readRuntimeItemPrimaryActionFx {
	export type Result =
		| {
				readonly kind: "none";
		  }
		| {
				readonly kind: "enqueue-default-line";
				readonly lineUid: string;
				readonly canEnqueue: boolean;
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
			let canEnqueue = false;
			if (
				queue.available &&
				isLineAdmissionOpenFn({
					owner: item,
					lineUid: defaultLine.uid,
				})
			) {
				const resolution = yield* resolveLineStartFx({
					ownerItemId: item.id,
					lineUid: defaultLine.uid,
					runtime,
				});
				const conditions = yield* Effect.result(
					assertLineEnqueueConditionsFx({
						resolution,
						runtime,
					}),
				);
				canEnqueue = Result.isSuccess(conditions);
			}
			return {
				kind: "enqueue-default-line" as const,
				lineUid: defaultLine.uid,
				canEnqueue,
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
