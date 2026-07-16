import { Array, Effect, Option, pipe } from "effect";

import type { IdSchema } from "~/engine/common/schema/IdSchema";
import type { PositiveIntegerSchema } from "~/engine/common/schema/PositiveIntegerSchema";
import { ItemNotFoundError } from "~/engine/item/error/ItemNotFoundError";
import { ItemStatefulError } from "~/engine/item/error/ItemStatefulError";
import { isItemPureFx } from "~/engine/item/fx/purity/isItemPureFx";
import { assertPlacementMaxCountFx } from "~/engine/placement/fx/assertPlacementMaxCountFx";
import { assertRevisionFx } from "~/engine/revision/fx/assertRevisionFx";
import { assertNonJobScopeFx } from "~/engine/runtime/fx/assertNonJobScopeFx";
import type { RevisionSchema } from "~/engine/revision/schema/RevisionSchema";
import { reviseRuntimeItemFx } from "~/engine/runtime/fx/reviseRuntimeItemFx";
import { modifyRuntimeFx } from "~/engine/runtime/internal/modifyRuntimeFx";
import type { RuntimeItemSchema } from "~/engine/runtime/schema/RuntimeItemSchema";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";

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

			const replacementRuntime = {
				...runtime,
				items: runtime.items.filter((candidate) => candidate.id !== item.id),
			} satisfies RuntimeSchema.Type;
			yield* assertPlacementMaxCountFx({
				drop: {
					itemId: item.item.id,
					placement: "drop",
					quantity,
				},
				item: item.item,
				runtime: replacementRuntime,
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
