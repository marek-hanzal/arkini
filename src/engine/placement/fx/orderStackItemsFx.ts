import { Effect } from "effect";

import type { PositionSchema } from "~/engine/grid/schema/PositionSchema";
import type { GridRuntimeItemSchema } from "~/engine/runtime/schema/GridRuntimeItemSchema";

export namespace orderStackItemsFx {
	export interface Props {
		items: ReadonlyArray<GridRuntimeItemSchema.Type>;
		origin?: PositionSchema.Type;
	}
}

/**
 * Orders stack candidates by origin distance or deterministic scan order.
 */
export const orderStackItemsFx = Effect.fn("orderStackItemsFx")(function* ({
	items,
	origin,
}: orderStackItemsFx.Props) {
	return [
		...items,
	].sort((left, right) => {
		const scanOrder =
			left.location.position.y - right.location.position.y ||
			left.location.position.x - right.location.position.x ||
			left.id.localeCompare(right.id);
		if (origin === undefined) {
			return scanOrder;
		}

		const leftDistance =
			Math.abs(left.location.position.x - origin.x) +
			Math.abs(left.location.position.y - origin.y);
		const rightDistance =
			Math.abs(right.location.position.x - origin.x) +
			Math.abs(right.location.position.y - origin.y);

		return leftDistance - rightDistance || scanOrder;
	});
});
