import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { useGameFx } from "~/v1/game/fx/useGameFx";
import { dropRuleFx } from "./dropRuleFx";
import {
	createDropRuleOriginFx,
	dropRuleTestConfig,
	permitQuery,
	placePermitFx,
} from "./test/dropRuleTestRuntime";

describe("dropRuleFx", () => {
	it("returns neutral schema-backed results for enable and disable rules", () => {
		const result = Effect.runSync(
			Effect.gen(function* () {
				const origin = yield* createDropRuleOriginFx();
				yield* placePermitFx();

				const enablePassed = yield* dropRuleFx({
					origin,
					rule: {
						type: "enable",
						when: [
							{
								type: "exists",
								query: permitQuery,
							},
							{
								type: "count",
								query: permitQuery,
								count: 2,
							},
						],
					},
				});
				const enableRejected = yield* dropRuleFx({
					origin,
					rule: {
						type: "enable",
						when: [
							{
								type: "exists",
								query: permitQuery,
							},
							{
								type: "count",
								query: permitQuery,
								count: 3,
							},
						],
					},
				});
				const disableApplied = yield* dropRuleFx({
					origin,
					rule: {
						type: "disable",
						when: [
							{
								type: "exists",
								query: permitQuery,
							},
							{
								type: "count",
								query: permitQuery,
								count: 2,
							},
						],
					},
				});
				const disableIgnored = yield* dropRuleFx({
					origin,
					rule: {
						type: "disable",
						when: [
							{
								type: "exists",
								query: permitQuery,
							},
							{
								type: "count",
								query: permitQuery,
								count: 3,
							},
						],
					},
				});

				return {
					disableApplied,
					disableIgnored,
					enablePassed,
					enableRejected,
				};
			}).pipe(
				useGameFx({
					config: dropRuleTestConfig,
				}),
			),
		);

		expect(result).toEqual({
			disableApplied: {
				active: true,
				type: "disable",
			},
			disableIgnored: {
				active: false,
				type: "disable",
			},
			enablePassed: {
				active: true,
				type: "enable",
			},
			enableRejected: {
				active: false,
				type: "enable",
			},
		});
	});
});
