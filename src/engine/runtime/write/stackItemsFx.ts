import { Effect } from "effect";

import type { IdSchema } from "~/engine/common/schema/IdSchema";
import type { GridLocationSchema } from "~/engine/location/schema/GridLocationSchema";
import type { PositiveIntegerSchema } from "~/engine/common/schema/PositiveIntegerSchema";
import type { RevisionSchema } from "~/engine/revision/schema/RevisionSchema";
import { StackItemsUnavailableError } from "~/engine/runtime/error/StackItemsUnavailableError";
import { removeRuntimeItemIdentityFx } from "~/engine/runtime/fx/removeRuntimeItemIdentityFx";
import { reviseRuntimeItemFx } from "~/engine/runtime/fx/reviseRuntimeItemFx";
import { modifyRuntimeFx } from "~/engine/runtime/internal/modifyRuntimeFx";
import { readItemStackResolutionFx } from "~/engine/runtime/read/readItemStackResolutionFx";
import type { GridRuntimeItemSchema } from "~/engine/runtime/schema/GridRuntimeItemSchema";
import type { RuntimeItemSchema } from "~/engine/runtime/schema/RuntimeItemSchema";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";

export namespace stackItemsFx {
	export interface Props {
		readonly sourceItemId: IdSchema.Type;
		readonly sourceRevision: RevisionSchema.Type;
		readonly sourceLocation: GridLocationSchema.Type;
		readonly targetItemId: IdSchema.Type;
		readonly targetRevision: RevisionSchema.Type;
		readonly targetLocation: GridLocationSchema.Type;
	}

	export interface Result {
		readonly transferredQuantity: PositiveIntegerSchema.Type;
		readonly sourceBefore: GridRuntimeItemSchema.Type;
		readonly sourceAfter?: GridRuntimeItemSchema.Type;
		readonly targetBefore: GridRuntimeItemSchema.Type;
		readonly targetAfter: GridRuntimeItemSchema.Type;
	}
}

/** Atomically transfers one pure compatible stack into another exact live grid identity. */
export const stackItemsFx = Effect.fn("stackItemsFx")(function* ({
	sourceItemId,
	sourceRevision,
	sourceLocation,
	targetItemId,
	targetRevision,
	targetLocation,
}: stackItemsFx.Props) {
	return yield* modifyRuntimeFx((runtime) => {
		return Effect.gen(function* () {
			const resolution = yield* readItemStackResolutionFx({
				runtime,
				sourceItemId,
				sourceRevision,
				sourceLocation,
				targetItemId,
				targetRevision,
				targetLocation,
			});
			if (resolution.kind !== "available") {
				return yield* Effect.fail(
					new StackItemsUnavailableError({
						sourceItemId,
						targetItemId,
						reason: resolution.reason,
					}),
				);
			}

			const sourceRemainingQuantity =
				resolution.source.quantity - resolution.transferredQuantity;
			const sourceAfter =
				sourceRemainingQuantity === 0
					? undefined
					: yield* reviseRuntimeItemFx({
							item: {
								...resolution.source,
								quantity: sourceRemainingQuantity,
							} satisfies RuntimeItemSchema.Type,
						});
			const sourceRuntime =
				sourceAfter === undefined
					? yield* removeRuntimeItemIdentityFx({
							item: resolution.source,
							runtime,
						})
					: ({
							...runtime,
							items: runtime.items.map((item) => {
								return item.id === sourceItemId ? sourceAfter : item;
							}),
						} satisfies RuntimeSchema.Type);
			const targetAfter = yield* reviseRuntimeItemFx({
				item: {
					...resolution.target,
					quantity: resolution.target.quantity + resolution.transferredQuantity,
				} satisfies RuntimeItemSchema.Type,
			});
			const nextRuntime = {
				...sourceRuntime,
				items: sourceRuntime.items.map((item) => {
					return item.id === targetItemId ? targetAfter : item;
				}),
			} satisfies RuntimeSchema.Type;
			const result = {
				transferredQuantity: resolution.transferredQuantity,
				sourceBefore: resolution.source,
				...(sourceAfter === undefined
					? {}
					: {
							sourceAfter,
						}),
				targetBefore: resolution.target,
				targetAfter,
			} satisfies stackItemsFx.Result;

			return [
				result,
				nextRuntime,
			] as const;
		});
	});
});
