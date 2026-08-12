import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { useGameFx } from "~/engine/game/fx/useGameFx";
import { PlannerGamePolicyLayerFx } from "~/engine/game/layer/PlannerGamePolicyLayerFx";
import { spawnItemFx } from "~/engine/runtime/write/spawnItemFx";
import { whenFx } from "~/engine/when/fx/whenFx";
import {
	createDropRuleOriginFx,
	dropRuleTestConfig,
} from "~test/output/fx/support/dropRuleTestRuntime";

describe("planner when evaluation policy", () => {
	it("chooses an existential non-self layout without manufacturing quantity", () => {
		const result = Effect.runSync(
			Effect.gen(function* () {
				const origin = yield* createDropRuleOriginFx();
				if (origin.location.scope !== "board")
					return yield* Effect.die("Expected board origin.");
				yield* spawnItemFx({
					id: "permit-stack",
					itemId: "permit",
					location: {
						scope: "board",
						space: 0,
						position: {
							x: 9,
							y: 9,
						},
					},
					quantity: 3,
				});
				const closePermit = {
					query: {
						distance: "close" as const,
						scope: "board" as const,
						selector: {
							itemId: "permit",
							type: "item" as const,
						},
					},
				};

				return {
					absentSatisfy: yield* whenFx({
						intent: "satisfy",
						origin: origin.location,
						when: {
							query: {
								...closePermit.query,
								selector: {
									itemId: "missing",
									type: "item",
								},
							},
							type: "exists",
						},
					}),
					countOneSatisfy: yield* whenFx({
						intent: "satisfy",
						origin: origin.location,
						when: {
							...closePermit,
							count: 1,
							type: "count",
						},
					}),
					countThreeSatisfy: yield* whenFx({
						intent: "satisfy",
						origin: origin.location,
						when: {
							...closePermit,
							count: 3,
							type: "count",
						},
					}),
					countFourSatisfy: yield* whenFx({
						intent: "satisfy",
						origin: origin.location,
						when: {
							...closePermit,
							count: 4,
							type: "count",
						},
					}),
					exactClose: yield* whenFx({
						origin: origin.location,
						when: {
							...closePermit,
							type: "exists",
						},
					}),
					exactNonSpatialDisable: yield* whenFx({
						intent: "falsify",
						origin: origin.location,
						when: {
							query: {
								scope: "any",
								selector: {
									itemId: "permit",
									type: "item",
								},
							},
							type: "exists",
						},
					}),
					falsifyExists: yield* whenFx({
						intent: "falsify",
						origin: origin.location,
						when: {
							...closePermit,
							type: "exists",
						},
					}),
					satisfyExists: yield* whenFx({
						intent: "satisfy",
						origin: origin.location,
						when: {
							...closePermit,
							type: "exists",
						},
					}),
				};
			}).pipe(
				Effect.provide(PlannerGamePolicyLayerFx),
				useGameFx({
					config: dropRuleTestConfig,
				}),
			),
		);

		expect(result).toEqual({
			absentSatisfy: false,
			countOneSatisfy: true,
			countThreeSatisfy: true,
			countFourSatisfy: false,
			exactClose: false,
			exactNonSpatialDisable: true,
			falsifyExists: false,
			satisfyExists: true,
		});
	});
});
