import { Array, Effect, Option, pipe } from "effect";

import type { IdSchema } from "~/engine/common/schema/IdSchema";
import { ItemNotFoundError } from "~/engine/item/error/ItemNotFoundError";
import { ItemNotOnGridError } from "~/engine/item/error/ItemNotOnGridError";
import { assertRevisionFx } from "~/engine/revision/fx/assertRevisionFx";
import type { RevisionSchema } from "~/engine/revision/schema/RevisionSchema";
import { reviseRuntimeItemFx } from "~/engine/runtime/fx/reviseRuntimeItemFx";
import { modifyRuntimeFx } from "~/engine/runtime/internal/modifyRuntimeFx";
import { SwapSameItemError } from "~/engine/runtime/error/SwapSameItemError";
import { isBoardRuntimeItem } from "~/engine/runtime/read/isBoardRuntimeItem";
import { isGridRuntimeItem } from "~/engine/runtime/read/isGridRuntimeItem";
import { CrossSpaceBoardOperationError } from "~/engine/space/error/CrossSpaceBoardOperationError";
import type { SwapItemsResultSchema } from "~/engine/runtime/schema/command/SwapItemsResultSchema";
import type { RuntimeItemSchema } from "~/engine/runtime/schema/RuntimeItemSchema";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";

export namespace swapItemsFx {
	export interface Props {
		firstItemId: IdSchema.Type;
		firstItemRevision: RevisionSchema.Type;
		secondItemId: IdSchema.Type;
		secondItemRevision: RevisionSchema.Type;
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
			const findItem = (itemId: IdSchema.Type) => {
				return pipe(
					runtime.items,
					Array.findFirst((candidate) => candidate.id === itemId),
					Option.getOrUndefined,
				);
			};
			const first = findItem(firstItemId);
			if (first === undefined) {
				return yield* Effect.fail(
					new ItemNotFoundError({
						itemId: firstItemId,
					}),
				);
			}
			const second = findItem(secondItemId);
			if (second === undefined) {
				return yield* Effect.fail(
					new ItemNotFoundError({
						itemId: secondItemId,
					}),
				);
			}
			yield* assertRevisionFx({
				actualRevision: first.revision,
				entityId: first.id,
				expectedRevision: firstItemRevision,
			});
			yield* assertRevisionFx({
				actualRevision: second.revision,
				entityId: second.id,
				expectedRevision: secondItemRevision,
			});
			if (!isGridRuntimeItem(first)) {
				return yield* Effect.fail(
					new ItemNotOnGridError({
						itemId: firstItemId,
						location: first.location,
					}),
				);
			}
			if (!isGridRuntimeItem(second)) {
				return yield* Effect.fail(
					new ItemNotOnGridError({
						itemId: secondItemId,
						location: second.location,
					}),
				);
			}
			if (
				isBoardRuntimeItem(first) &&
				isBoardRuntimeItem(second) &&
				first.location.space !== second.location.space
			) {
				return yield* Effect.fail(
					new CrossSpaceBoardOperationError({
						fromSpace: first.location.space,
						toSpace: second.location.space,
					}),
				);
			}
			const firstOnBoard = isBoardRuntimeItem(first);
			const secondOnBoard = isBoardRuntimeItem(second);
			const boardItem = firstOnBoard ? first : secondOnBoard ? second : undefined;
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
			} satisfies SwapItemsResultSchema.Type;
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
