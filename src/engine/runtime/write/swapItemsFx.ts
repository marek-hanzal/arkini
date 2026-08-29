import { Array, Effect, Option, pipe } from "effect";

import type { IdSchema } from "~/engine/common/schema/IdSchema";
import { ItemNotFoundError } from "~/engine/item/error/ItemNotFoundError";
import { ItemNotOnGridError } from "~/engine/item/error/ItemNotOnGridError";
import { assertRevisionFx } from "~/engine/revision/fx/assertRevisionFx";
import type { RevisionSchema } from "~/engine/revision/schema/RevisionSchema";
import { reviseRuntimeItemFx } from "~/engine/runtime/fx/reviseRuntimeItemFx";
import { modifyRuntimeFx } from "~/engine/runtime/internal/modifyRuntimeFx";
import { SwapSameItemError } from "~/engine/runtime/error/SwapSameItemError";
import { isBoardRuntimeItemFn } from "~/engine/runtime/read/fn/isBoardRuntimeItemFn";
import { isGridRuntimeItemFn } from "~/engine/runtime/read/fn/isGridRuntimeItemFn";
import { CrossSpaceBoardOperationError } from "~/item-location/error/CrossSpaceBoardOperationError";
import type { RuntimeItemSchema } from "~/engine/runtime/schema/RuntimeItemSchema";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";

export namespace swapItemsFx {
	export interface Props {
		firstItemId: IdSchema.Type;
		firstItemRevision: RevisionSchema.Type;
		secondItemId: IdSchema.Type;
		secondItemRevision: RevisionSchema.Type;
	}

	export interface Result {
		readonly first: RuntimeItemSchema.Type;
		readonly second: RuntimeItemSchema.Type;
	}
}

/**
 * Atomically exchanges the locations owned by two live items.
 */
export const swapItemsFx = Effect.fn("swapItemsFx")(function* ({
	firstItemId,
	firstItemRevision,
	secondItemId,
	secondItemRevision,
}: swapItemsFx.Props) {
	if (firstItemId === secondItemId) {
		return yield* Effect.fail(
			new SwapSameItemError({
				itemId: firstItemId,
			}),
		);
	}

	return yield* modifyRuntimeFx((runtime) => {
		return Effect.gen(function* () {
			const runtimeFirst = pipe(
				runtime.items,
				Array.findFirst((candidate) => candidate.id === firstItemId),
				Option.getOrUndefined,
			);
			if (runtimeFirst === undefined) {
				return yield* Effect.fail(
					new ItemNotFoundError({
						itemId: firstItemId,
					}),
				);
			}
			const runtimeSecond = pipe(
				runtime.items,
				Array.findFirst((candidate) => candidate.id === secondItemId),
				Option.getOrUndefined,
			);
			if (runtimeSecond === undefined) {
				return yield* Effect.fail(
					new ItemNotFoundError({
						itemId: secondItemId,
					}),
				);
			}
			yield* assertRevisionFx({
				actualRevision: runtimeFirst.revision,
				entityId: runtimeFirst.id,
				expectedRevision: firstItemRevision,
			});
			yield* assertRevisionFx({
				actualRevision: runtimeSecond.revision,
				entityId: runtimeSecond.id,
				expectedRevision: secondItemRevision,
			});
			const first = Option.getOrUndefined(isGridRuntimeItemFn(runtimeFirst));
			if (first === undefined) {
				return yield* Effect.fail(
					new ItemNotOnGridError({
						itemId: firstItemId,
						location: runtimeFirst.location,
					}),
				);
			}
			const second = Option.getOrUndefined(isGridRuntimeItemFn(runtimeSecond));
			if (second === undefined) {
				return yield* Effect.fail(
					new ItemNotOnGridError({
						itemId: secondItemId,
						location: runtimeSecond.location,
					}),
				);
			}
			const boardFirst = Option.getOrUndefined(isBoardRuntimeItemFn(first));
			const boardSecond = Option.getOrUndefined(isBoardRuntimeItemFn(second));
			if (
				boardFirst !== undefined &&
				boardSecond !== undefined &&
				boardFirst.location.space !== boardSecond.location.space
			) {
				return yield* Effect.fail(
					new CrossSpaceBoardOperationError({
						fromSpace: boardFirst.location.space,
						toSpace: boardSecond.location.space,
					}),
				);
			}
			const firstOnBoard = boardFirst !== undefined;
			const secondOnBoard = boardSecond !== undefined;
			const boardItem = boardFirst ?? boardSecond;
			if (
				firstOnBoard !== secondOnBoard &&
				boardItem !== undefined &&
				boardItem.location.space !== runtime.currentSpace
			) {
				return yield* Effect.fail(
					new CrossSpaceBoardOperationError({
						fromSpace: runtime.currentSpace,
						toSpace: boardItem.location.space,
					}),
				);
			}

			const swappedFirst = yield* reviseRuntimeItemFx({
				item: {
					...first,
					location: second.location,
				} satisfies RuntimeItemSchema.Type,
			});
			const swappedSecond = yield* reviseRuntimeItemFx({
				item: {
					...second,
					location: first.location,
				} satisfies RuntimeItemSchema.Type,
			});
			const result = {
				first: swappedFirst,
				second: swappedSecond,
			} satisfies swapItemsFx.Result;
			const nextRuntime = {
				...runtime,
				items: runtime.items.map((candidate) => {
					if (candidate.id === firstItemId) {
						return swappedFirst;
					}
					if (candidate.id === secondItemId) {
						return swappedSecond;
					}

					return candidate;
				}),
			} satisfies RuntimeSchema.Type;

			return [
				result,
				nextRuntime,
			] as const;
		});
	});
});
