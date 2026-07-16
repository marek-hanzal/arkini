import { Array, Effect, Option, pipe } from "effect";

import type { IdSchema } from "~/engine/common/schema/IdSchema";
import { ItemNotFoundError } from "~/engine/item/error/ItemNotFoundError";
import { assertOwnerIdleFx } from "~/engine/job/fx/assertOwnerIdleFx";
import { assertRevisionFx } from "~/engine/revision/fx/assertRevisionFx";
import { assertNonJobScopeFx } from "~/engine/runtime/fx/assertNonJobScopeFx";
import type { RevisionSchema } from "~/engine/revision/schema/RevisionSchema";
import { modifyRuntimeFx } from "~/engine/runtime/internal/modifyRuntimeFx";
import { removeRuntimeItemFx } from "~/engine/runtime/fx/removeRuntimeItemFx";

export namespace removeItemFx {
	export interface Props {
		itemId: IdSchema.Type;
		revision: RevisionSchema.Type;
	}
}

/**
 * Atomically removes one live item by its stable identity.
 */
export const removeItemFx = Effect.fn("removeItemFx")(function* ({
	itemId,
	revision,
}: removeItemFx.Props) {
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
			yield* assertOwnerIdleFx({
				ownerItemId: item.id,
				runtime,
			});

			const nextRuntime = yield* removeRuntimeItemFx({
				item,
				runtime,
			});

			return [
				item,
				nextRuntime,
			] as const;
		});
	});
});
