import { Array, Effect, Option, pipe } from "effect";

import type { IdSchema } from "~/v1/common/schema/IdSchema";
import type { PositiveIntegerSchema } from "~/v1/common/schema/PositiveIntegerSchema";
import { ItemNotFoundError } from "~/v1/item/error/ItemNotFoundError";
import { ItemStatefulError } from "~/v1/item/error/ItemStatefulError";
import { isItemPureFx } from "~/v1/item/fx/purity/isItemPureFx";
import { assertPlacementMaxCountFx } from "~/v1/placement/fx/assertPlacementMaxCountFx";
import { assertRevisionFx } from "~/v1/revision/fx/assertRevisionFx";
import { assertNonJobScopeFx } from "~/v1/runtime/fx/assertNonJobScopeFx";
import type { RevisionSchema } from "~/v1/revision/schema/RevisionSchema";
import { reviseRuntimeItemFx } from "~/v1/runtime/fx/reviseRuntimeItemFx";
import { modifyRuntimeFx } from "~/v1/runtime/internal/modifyRuntimeFx";
import type { RuntimeItemSchema } from "~/v1/runtime/schema/RuntimeItemSchema";
import type { RuntimeSchema } from "~/v1/runtime/schema/RuntimeSchema";

export namespace setItemQuantityFx {
	export interface Props {
		itemId: IdSchema.Type;
		quantity: PositiveIntegerSchema.Type;
		revision: RevisionSchema.Type;
	}
}

/**
 * Atomically sets one live item's stack quantity.
 */
export const setItemQuantityFx = Effect.fn("setItemQuantityFx")(function* ({
	itemId,
	quantity,
	revision,
}: setItemQuantityFx.Props) {
	return yield* modifyRuntimeFx((runtime) => {
		return Effect.gen(function* () {
			const item = pipe(
				runtime.items,
				Array.findFirst((candidate) => candidate.id === itemId),
				Option.getOrUndefined,
			);
			if (item === undefined) {
				return yield* Effect.fail(
					new ItemNotFoundError({
						itemId,
					}),
				);
			}

			yield* assertRevisionFx({
				actualRevision: item.revision,
				entityId: item.id,
				expectedRevision: revision,
			});

			yield* assertNonJobScopeFx({
				item,
			});

			const pure = yield* isItemPureFx({
				item,
				runtime,
			});
			if (!pure) {
				return yield* Effect.fail(
					new ItemStatefulError({
						itemId: item.id,
					}),
				);
			}

			yield* assertPlacementMaxCountFx({
				drop: {
					itemId: item.item.id,
					placement: "drop",
					quantity,
				},
				item: item.item,
				runtime,
			});

			const updatedItem = yield* reviseRuntimeItemFx({
				item: {
					...item,
					quantity,
				} satisfies RuntimeItemSchema.Type,
			});
			const nextRuntime = {
				...runtime,
				items: runtime.items.map((candidate) => {
					return candidate.id === itemId ? updatedItem : candidate;
				}),
			} satisfies RuntimeSchema.Type;

			return [
				updatedItem,
				nextRuntime,
			] as const;
		});
	});
});
