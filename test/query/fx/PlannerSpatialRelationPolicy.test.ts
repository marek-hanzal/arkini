import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { useGameFx } from "~/engine/game/fx/useGameFx";
import { PlannerGamePolicyLayerFx } from "~/engine/game/layer/PlannerGamePolicyLayerFx";
import { queryFx } from "~/engine/query/fx/queryFx";
import { spawnItemFx } from "~/engine/runtime/write/spawnItemFx";
import {
	createDropRuleOriginFx,
	dropRuleTestConfig,
} from "~test/output/fx/support/dropRuleTestRuntime";

describe("planner spatial relation policy", () => {
	it("relaxes only existing non-self items from the origin space", () => {
		const run = (planner: boolean) => {
			const program = Effect.gen(function* () {
				const origin = yield* createDropRuleOriginFx();
				if (origin.location.scope !== "board")
					return yield* Effect.die("Expected board origin.");
				const originLocation = origin.location;
				yield* spawnItemFx({
					id: "same-space-permit",
					itemId: "permit",
					location: {
						scope: "board",
						space: originLocation.space,
						position: {
							x: 9,
							y: 9,
						},
					},
					quantity: 1,
				});
				yield* spawnItemFx({
					id: "other-space-permit",
					itemId: "permit",
					location: {
						scope: "board",
						space: originLocation.space + 1,
						position: {
							x: originLocation.position.x + 1,
							y: originLocation.position.y,
						},
					},
					quantity: 1,
				});

				const query = (itemId: string) =>
					queryFx({
						origin: originLocation,
						query: {
							distance: "close",
							scope: "board",
							selector: {
								itemId,
								type: "item",
							},
						},
					});

				return {
					missing: yield* query("missing"),
					origin: yield* query(origin.item.id),
					permit: yield* query("permit"),
				};
			}).pipe(
				useGameFx({
					config: dropRuleTestConfig,
				}),
			);

			return Effect.runSync(
				planner ? program.pipe(Effect.provide(PlannerGamePolicyLayerFx)) : program,
			);
		};

		expect(run(false).permit).toEqual([]);
		const planner = run(true);
		expect(planner.permit.map((item) => item.id)).toEqual([
			"same-space-permit",
		]);
		expect(planner.missing).toEqual([]);
		expect(planner.origin).toEqual([]);
	});
});
