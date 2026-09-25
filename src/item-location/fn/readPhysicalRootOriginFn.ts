import type { BoardLocationSchema } from "~/item-location/schema/BoardLocationSchema";
import type { LocationSchema } from "~/item-location/schema/LocationSchema";

/** A physical root retains its home origin; internally owned items have no origin of their own. */
export const readPhysicalRootOriginFn = (
	location: LocationSchema.Type,
): BoardLocationSchema.Type | undefined => {
	switch (location.scope) {
		case "board":
			return location;
		case "delivery":
		case "terminal":
			return location.origin;
		case "input":
		case "job":
		case "reserved":
			return undefined;
		default: {
			const unhandled: never = location;
			return unhandled;
		}
	}
};
