import { Array, Effect, Option, pipe } from "effect";

import type { IdSchema } from "~/v1/common/schema/IdSchema";
import { ItemNotFoundError } from "~/v1/item/error/ItemNotFoundError";
import { ItemNotOnGridError } from "~/v1/item/error/ItemNotOnGridError";
import { assertRevisionFx } from "~/v1/revision/fx/assertRevisionFx";
import type { RevisionSchema } from "~/v1/revision/schema/RevisionSchema";
import { reviseRuntimeItemFx } from "~/v1/runtime/fx/reviseRuntimeItemFx";
import { modifyRuntimeFx } from "~/v1/runtime/internal/modifyRuntimeFx";
import { isGridRuntimeItem } from "~/v1/runtime/read/isGridRuntimeItem";
import type { SwapItemsResultSchema } from "~/v1/runtime/schema/command/SwapItemsResultSchema";
import type { RuntimeItemSchema } from "~/v1/runtime/schema/RuntimeItemSchema";
import type { RuntimeSchema } from "~/v1/runtime/schema/RuntimeSchema";

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
