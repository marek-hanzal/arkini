import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { SpatialRelationFx } from "~/engine/distance/context/SpatialRelationFx";
import { matchesSpatialRelationFx } from "~/engine/distance/fx/matchesSpatialRelationFx";

describe("SpatialRelationFx", () => {
	it("uses canonical geometry by default and permits a scoped override", () => {
		const props = {
			distance: "close" as const,
			item: {
				x: 9,
				y: 9,
			},
			origin: {
				x: 0,
				y: 0,
			},
		};
		const result = Effect.runSync(
			Effect.gen(function* () {
				const canonical = yield* matchesSpatialRelationFx(props);
				const overridden = yield* matchesSpatialRelationFx(props).pipe(
					Effect.provideService(SpatialRelationFx, {
						matches: () => Effect.succeed(true),
					}),
				);
				return {
					canonical,
					overridden,
				};
			}),
		);

		expect(result).toEqual({
			canonical: false,
			overridden: true,
		});
	});
});
