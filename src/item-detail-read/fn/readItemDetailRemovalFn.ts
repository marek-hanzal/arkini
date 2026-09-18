import type { RuntimeItemSchema } from "~/game-runtime/schema/RuntimeItemSchema";
import type { CommittedTransitionSchema } from "~/game-runtime/schema/CommittedTransitionSchema";

export namespace readItemDetailRemovalFn {
	export interface Snapshot {
		readonly snapshot: RuntimeItemSchema.Type;
		readonly reason: "depleted" | "expired" | "gone";
	}
}

/** Reads the exact removed instance carried by a successful commit; never reconstructs its state. */
export const readItemDetailRemovalFn = (
	transition: CommittedTransitionSchema.Type,
	itemId: string,
): readItemDetailRemovalFn.Snapshot | undefined => {
	if (transition.runtime.items.some((item) => item.id === itemId)) return undefined;
	let snapshot: RuntimeItemSchema.Type | undefined;
	let reason: readItemDetailRemovalFn.Snapshot["reason"] = "gone";
	for (const event of transition.events) {
		if (event.type === "item:removed" && event.snapshot.id === itemId)
			snapshot = event.snapshot;
		if (!("itemId" in event) || event.itemId !== itemId) continue;
		if (event.type === "item:depleted" && event.resultingQuantity === 0) reason = "depleted";
		if (event.type === "item:expired" && reason !== "depleted") reason = "expired";
	}
	return snapshot === undefined
		? undefined
		: {
				snapshot,
				reason,
			};
};
