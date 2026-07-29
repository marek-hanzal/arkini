import { Effect } from "effect";

interface DropCollisionExpectation {
	readonly itemId: string;
	readonly revision: string;
}

/** Compares two collision snapshots as exact duplicate-free identity-to-revision maps. */
export const doDropCollisionExpectationsMatchFx = Effect.fn("doDropCollisionExpectationsMatchFx")(
	function* ({
		left,
		right,
	}: {
		readonly left: ReadonlyArray<DropCollisionExpectation>;
		readonly right: ReadonlyArray<DropCollisionExpectation>;
	}) {
		const index = (collisions: ReadonlyArray<DropCollisionExpectation>) => {
			const byItemId = new Map<string, string>();
			for (const collision of collisions) {
				if (byItemId.has(collision.itemId)) return undefined;
				byItemId.set(collision.itemId, collision.revision);
			}
			return byItemId;
		};
		const leftByItemId = index(left);
		const rightByItemId = index(right);
		if (
			leftByItemId === undefined ||
			rightByItemId === undefined ||
			leftByItemId.size !== rightByItemId.size
		) {
			return false;
		}
		for (const [itemId, revision] of leftByItemId) {
			if (rightByItemId.get(itemId) !== revision) return false;
		}
		return true;
	},
);
