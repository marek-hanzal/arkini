import { Array, Effect, Option, pipe } from "effect";

import type { IdSchema } from "~/v1/common/schema/IdSchema";
import { ItemNotFoundError } from "~/v1/item/error/ItemNotFoundError";
import { releaseOwnerInputsFx } from "~/v1/input/fx/releaseOwnerInputsFx";
import { assertOwnerIdleFx } from "~/v1/job/fx/assertOwnerIdleFx";
import { assertRevisionFx } from "~/v1/revision/fx/assertRevisionFx";
import { assertNonJobScopeFx } from "~/v1/runtime/fx/assertNonJobScopeFx";
import type { RevisionSchema } from "~/v1/revision/schema/RevisionSchema";
import { modifyRuntimeFx } from "~/v1/runtime/internal/modifyRuntimeFx";
import type { RuntimeSchema } from "~/v1/runtime/schema/RuntimeSchema";

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

			const releasedRuntime = yield* releaseOwnerInputsFx({
				owner: item,
				runtime,
			});
			const nextRuntime = {
				...releasedRuntime,
				items: releasedRuntime.items.filter((candidate) => candidate.id !== itemId),
			} satisfies RuntimeSchema.Type;

			return [
				item,
				nextRuntime,
			] as const;
		});
	});
});
