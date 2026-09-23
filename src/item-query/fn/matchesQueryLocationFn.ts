import { match } from "ts-pattern";
import type { BoardLocationSchema } from "~/item-location/schema/BoardLocationSchema";
import type { QuerySchema } from "~/item-query/schema/QuerySchema";

/** Shared spatial reach for runtime queries and material sources, including delivery origins. */
export const matchesQueryLocationFn = ({
	location,
	origin,
	query,
}: {
	readonly location: BoardLocationSchema.Type;
	readonly origin?: BoardLocationSchema.Type;
	readonly query: QuerySchema.Type;
}): boolean => {
	if (origin === undefined || location.space !== origin.space) return false;
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
};
