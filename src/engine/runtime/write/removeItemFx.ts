import { Effect } from "effect";

import type { IdSchema } from "~/engine/common/schema/IdSchema";
import { GameEventEnumSchema } from "~/engine/event/schema/GameEventEnumSchema";
import type { GameEventSchema } from "~/engine/event/schema/GameEventSchema";
import { assertOwnerIdleFx } from "~/engine/job/fx/assertOwnerIdleFx";
import type { RevisionSchema } from "~/engine/revision/schema/RevisionSchema";
import { modifyRuntimeFx } from "~/engine/runtime/internal/modifyRuntimeFx";
import { removeRuntimeItemFx } from "~/engine/runtime/fx/removeRuntimeItemFx";
import { readValidatedRuntimeItemFx } from "~/engine/runtime/read/readValidatedRuntimeItemFx";

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
			const item = yield* readValidatedRuntimeItemFx({
				itemId,
				revision,
				runtime,
			});
			yield* assertOwnerIdleFx({
				ownerItemId: item.id,
				runtime,
			});

			const explicitlyRemovedEvent = {
				type: GameEventEnumSchema.enum.ItemExplicitlyRemoved,
				itemId: item.id,
				canonicalItemId: item.item.id,
				location: item.location,
				quantity: item.quantity,
			} satisfies GameEventSchema.Type;
			const removal = yield* removeRuntimeItemFx({
				item,
				runtime,
			});

			return [
				item,
				removal.runtime,
				[
					explicitlyRemovedEvent,
					...removal.events,
				],
			] as const;
		});
	});
});
