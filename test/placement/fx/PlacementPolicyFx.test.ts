import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { useGameFx } from "~/engine/game/fx/useGameFx";
import { planDropPlacementFx } from "~/engine/placement/fx/planDropPlacementFx";
import { planPolicyDropPlacementFx } from "~/engine/placement/fx/planPolicyDropPlacementFx";
import { readRuntimeFx } from "~/engine/runtime/read/readRuntimeFx";
import { spawnItemFx } from "~/engine/runtime/write/spawnItemFx";
import { boardLocation, placementTestConfig } from "~test/placement/fx/support/placementTestConfig";

describe("PlacementPolicyFx", () => {
	it("keeps the default policy identical to canonical placement planning", () => {
		const result = Effect.runSync(
			Effect.gen(function* () {
				yield* spawnItemFx({
					id: "origin",
					itemId: "origin",
					location: boardLocation(1),
					quantity: 1,
				});
				const runtime = yield* readRuntimeFx();
				const props = {
					drop: {
						itemId: "log",
						placement: "drop" as const,
						quantity: 4,
					},
					origin: boardLocation(1),
					runtime,
				};
				return {
					direct: yield* planDropPlacementFx(props),
					policy: yield* planPolicyDropPlacementFx(props),
				};
			}).pipe(
				useGameFx({
					config: placementTestConfig,
				}),
			),
		);

		expect({
			remove: result.policy.remove,
			spawn: result.policy.spawn.map(({ item }) => ({
				itemId: item.item.id,
				location: item.location,
				quantity: item.quantity,
			})),
			stack: result.policy.stack,
		}).toEqual({
			remove: result.direct.remove,
			spawn: result.direct.spawn.map(({ item }) => ({
				itemId: item.item.id,
				location: item.location,
				quantity: item.quantity,
			})),
			stack: result.direct.stack,
		});
	});
});
