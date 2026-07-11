import { Effect, Either } from "effect";
import { describe, expect, it } from "vitest";

import { useGameFx } from "~/v1/game/fx/useGameFx";
import { applyPlacementPlanFx } from "~/v1/placement/fx/applyPlacementPlanFx";
import { startTestConfig } from "./test/startTestConfig";
import { planStartFx } from "./planStartFx";

describe("planStartFx", () => {
	it("combines board and inventory plans against one evolving draft", () => {
		const result = Effect.runSync(
			Effect.gen(function* () {
				const runtime = {
					items: [],
				};
				const plan = yield* planStartFx({
					runtime,
					start: startTestConfig.start,
				});
				const [, nextRuntime] = yield* applyPlacementPlanFx({
					plan,
					runtime,
				});

				return nextRuntime;
			}).pipe(
				useGameFx({
					config: startTestConfig,
				}),
			),
		);

		expect(result.items).toHaveLength(3);
		expect(result.items).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					item: startTestConfig.items.tree,
					location: {
						position: {
							x: 1,
							y: 1,
						},
						scope: "board",
					},
					quantity: 1,
				}),
				expect.objectContaining({
					item: startTestConfig.items.log,
					location: {
						position: {
							x: 0,
							y: 0,
						},
						scope: "inventory",
					},
					quantity: 3,
				}),
				expect.objectContaining({
					item: startTestConfig.items.log,
					location: {
						position: {
							x: 1,
							y: 0,
						},
						scope: "inventory",
					},
					quantity: 1,
				}),
			]),
		);
	});

	it("rejects conflicting exact board locations", () => {
		const result = Effect.runSync(
			Effect.either(
				planStartFx({
					runtime: {
						items: [],
					},
					start: {
						board: [
							{
								itemId: "tree",
								x: 0,
								y: 0,
							},
							{
								itemId: "tree",
								x: 0,
								y: 0,
							},
						],
						inventory: [],
					},
				}),
			).pipe(
				useGameFx({
					config: startTestConfig,
				}),
			),
		);

		expect(Either.isLeft(result)).toBe(true);
		if (Either.isLeft(result)) {
			expect(result.left).toMatchObject({
				_tag: "RuntimeInvalidError",
				result: {
					issues: [
						expect.objectContaining({
							type: "location:occupied",
						}),
					],
				},
			});
		}
	});
});
