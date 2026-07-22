import { Effect, Either } from "effect";
import { describe, expect, it } from "vitest";

import { useGameFx } from "~/engine/game/fx/useGameFx";
import { startTestConfig } from "~test/start/fx/support/startTestConfig";
import { planStartFx } from "~/engine/start/fx/planStartFx";
import { RuntimeCheckIssueEnumSchema } from "~/engine/runtime/schema/check/RuntimeCheckIssueEnumSchema";

describe("planStartFx", () => {
	it("combines board and inventory plans against one evolving draft", () => {
		const result = Effect.runSync(
			Effect.gen(function* () {
				const runtime = {
					cheats: {
						enabled: false,
						everEnabled: false,
						instantGameplay: false,
					},
					currentSpace: 0,
					items: [],
					jobs: [],
				};
				return yield* planStartFx({
					runtime,
					start: startTestConfig.start,
				});
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
						space: 0,
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

	it("preserves quantity across dependent repeated inventory entries", () => {
		const result = Effect.runSync(
			planStartFx({
				runtime: {
					cheats: {
						enabled: false,
						everEnabled: false,
						instantGameplay: false,
					},
					currentSpace: 0,
					items: [],
					jobs: [],
				},
				start: {
					currentSpace: 0,
					board: [],
					inventory: [
						{
							itemId: "log",
							quantity: 2,
						},
						{
							itemId: "log",
							quantity: 3,
						},
					],
				},
			}).pipe(
				useGameFx({
					config: startTestConfig,
				}),
			),
		);

		expect(result.items).toHaveLength(2);
		expect(result.items.map((item) => item.quantity)).toEqual([
			3,
			2,
		]);
		expect(result.items.reduce((sum, item) => sum + item.quantity, 0)).toBe(5);
	});

	it("rejects conflicting exact board locations", () => {
		const result = Effect.runSync(
			Effect.either(
				planStartFx({
					runtime: {
						cheats: {
							enabled: false,
							everEnabled: false,
							instantGameplay: false,
						},
						currentSpace: 0,
						items: [],
						jobs: [],
					},
					start: {
						currentSpace: 0,
						board: [
							{
								space: 0,
								itemId: "tree",
								x: 0,
								y: 0,
							},
							{
								space: 0,
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
							type: RuntimeCheckIssueEnumSchema.enum.LocationOccupied,
						}),
					],
				},
			});
		}
	});
});
