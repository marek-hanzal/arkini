import { match } from "ts-pattern";
import type { GridLocationSchema } from "~/item-location/schema/GridLocationSchema";
import type { QuerySchema } from "~/item-query/schema/QuerySchema";

/** Shared spatial reach for runtime queries and material sources, including delivery origins. */
export const matchesQueryLocationFn = ({
	location,
	origin,
	query,
	currentSpace,
}: {
	readonly location: GridLocationSchema.Type;
	readonly origin?: GridLocationSchema.Type;
	readonly query: QuerySchema.Type;
	readonly currentSpace: number;
}): boolean => {
	switch (query.scope) {
		case "inventory":
			return location.scope === "inventory";
		case "toolbar":
			return location.scope === "toolbar";
		case "universe":
			return true;
		case "any":
			return (
				location.scope !== "board" ||
				location.space === (origin?.scope === "board" ? origin.space : currentSpace)
			);
		case "board": {
			if (
				origin?.scope !== "board" ||
				location.scope !== "board" ||
				location.space !== origin.space
			)
				return false;
			const distance = Math.max(
				Math.abs(location.position.x - origin.position.x),
				Math.abs(location.position.y - origin.position.y),
			);
			return match(query.distance)
				.with("self", () => distance === 0)
				.with("close", () => distance === 1)
				.with("near-close", () => distance > 0 && distance <= 2)
				.with("near", () => distance === 2)
				.with("far", () => distance > 0)
				.exhaustive();
		}
	}
};
