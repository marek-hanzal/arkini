import { Effect } from "effect";

import {
	projectDropActorCurrentFx,
	type DropTransferActor,
} from "~/engine/runtime/drop/projectDropActorCurrentFx";

/** Projects the shared before/after actor shape used by drop commit results. */
export const projectDropTransferActorFx = Effect.fnUntraced(function* ({
	after,
	before,
}: {
	readonly after: DropTransferActor | undefined;
	readonly before: DropTransferActor;
}) {
	return {
		itemId: before.id,
		canonicalItemId: before.item.id,
		previousRevision: before.revision,
		previousLocation: before.location,
		previousQuantity: before.quantity,
		current: yield* projectDropActorCurrentFx(after),
	};
});
