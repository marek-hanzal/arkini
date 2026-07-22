import { Effect } from "effect";

import type { GameEventSchema } from "~/engine/event/schema/GameEventSchema";
import type { BoardRuntimeItemSchema } from "~/engine/runtime/schema/BoardRuntimeItemSchema";
import type { OutputPlacementResultSchema } from "~/engine/placement/schema/OutputPlacementResultSchema";
import { readOutputPlacementItemEventsFx } from "~/engine/event/read/readOutputPlacementItemEventsFx";

const sameLocation = (
	left: BoardRuntimeItemSchema.Type["location"],
	right: BoardRuntimeItemSchema.Type["location"],
) =>
	left.space === right.space &&
	left.position.x === right.position.x &&
	left.position.y === right.position.y;

/** Describes one exact outgoing lifecycle identity and its concrete placement handoff. */
export const readLifecycleItemEventsFx = Effect.fn("readLifecycleItemEventsFx")(function* ({
	outgoing,
	placement,
	reason,
}: {
	readonly outgoing: BoardRuntimeItemSchema.Type;
	readonly placement: OutputPlacementResultSchema.Type;
	readonly reason: "depleted" | "expired" | "lifecycle";
}) {
	const placementEvents = yield* readOutputPlacementItemEventsFx(placement);
	const replacement = placementEvents.find(
		(event) =>
			event.type === "item:spawned" &&
			event.location.scope === "board" &&
			sameLocation(outgoing.location, event.location),
	);
	const events: GameEventSchema.Type[] = [];
	if (replacement?.type === "item:spawned") {
		events.push({
			type: "item:replaced",
			outgoingItemId: outgoing.id,
			outgoingCanonicalItemId: outgoing.item.id,
			outgoingQuantity: outgoing.quantity,
			incomingItemId: replacement.itemId,
			incomingCanonicalItemId: replacement.canonicalItemId,
			incomingQuantity: replacement.quantity,
			location: replacement.location,
		});
	} else {
		events.push({
			type: "item:removed",
			itemId: outgoing.id,
			canonicalItemId: outgoing.item.id,
			location: outgoing.location,
			quantity: outgoing.quantity,
			reason,
		});
	}
	for (const event of placementEvents) {
		if (replacement?.type === "item:spawned" && event === replacement) continue;
		events.push(event);
	}
	return events;
});
