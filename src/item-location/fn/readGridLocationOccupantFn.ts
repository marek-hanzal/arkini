import type { GridLocationSchema } from "~/item-location/schema/GridLocationSchema";
import type { GridRuntimeItemSchema } from "~/game-runtime/schema/GridRuntimeItemSchema";
import type { RuntimeSchema } from "~/game-runtime/schema/RuntimeSchema";
import { isSameGridLocationFn } from "./isSameGridLocationFn";

/** Direct interaction sees content first; delivery leases reserve slots without covering ground. */
export const readGridLocationOccupantFn = ({
	runtime,
	location,
}: {
	readonly runtime: RuntimeSchema.Type;
	readonly location: GridLocationSchema.Type;
}) => {
	let ground: GridRuntimeItemSchema.Type | undefined;
	for (const item of runtime.items) {
		if (
			item.location.scope !== "board" &&
			item.location.scope !== "inventory" &&
			item.location.scope !== "toolbar"
		)
			continue;
		if (
			!isSameGridLocationFn({
				left: item.location,
				right: location,
			})
		)
			continue;
		const occupant = item as GridRuntimeItemSchema.Type;
		if (location.scope !== "board" || item.item.layer === "content") return occupant;
		ground = occupant;
	}
	return ground;
};
