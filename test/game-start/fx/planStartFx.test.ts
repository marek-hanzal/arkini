import { Effect, Result } from "effect";
import { describe, expect, it } from "vitest";

import { useGameFx } from "~test/support/game/useGameFx";
import { startTestConfig } from "~test/game-start/support/startTestConfig";
import { planStartFx } from "~/game-start/fx/planStartFx";
import { RuntimeCheckIssueEnumSchema } from "~/game-runtime/schema/RuntimeCheckIssueEnumSchema";

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

					jobQueue: [],
					defaultLineByOwnerItemId: {},
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

	it("materializes one exact eligible toolbar item", () => {
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
					jobQueue: [],

					defaultLineByOwnerItemId: {},
				},
				start: {
					currentSpace: 0,
					board: [],
					inventory: [],
					toolbar: [
						{
							itemId: "backpack",
							position: {
								x: 1,
								y: 0,
							},
						},
					],
				},
			}).pipe(
				useGameFx({
					config: startTestConfig,
				}),
			),
		);

		expect(result.items).toEqual([
			expect.objectContaining({
				item: startTestConfig.items.backpack,
				location: {
					position: {
						x: 1,
						y: 0,
					},
					scope: "toolbar",
				},
				quantity: 1,
			}),
		]);
	});

	it("materializes exact stacked board, toolbar, and positioned inventory starts", () => {
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
					jobQueue: [],

					defaultLineByOwnerItemId: {},
				},
				start: {
					currentSpace: 0,
					board: [
						{
							itemId: "log",
							quantity: 3,
							space: 0,
							x: 0,
							y: 0,
						},
					],
					inventory: [
						{
							itemId: "log",
							position: {
								x: 1,
								y: 0,
							},
							quantity: 2,
						},
					],
					toolbar: [
						{
							itemId: "log",
							position: {
								x: 0,
								y: 0,
							},
							quantity: 2,
						},
					],
				},
			}).pipe(
				useGameFx({
					config: startTestConfig,
				}),
			),
		);

		expect(result.items).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					location: {
						space: 0,
						position: {
							x: 0,
							y: 0,
						},
						scope: "board",
					},
					quantity: 3,
				}),
				expect.objectContaining({
					location: {
						position: {
							x: 1,
							y: 0,
						},
						scope: "inventory",
					},
					quantity: 2,
				}),
				expect.objectContaining({
					location: {
						position: {
							x: 0,
							y: 0,
						},
						scope: "toolbar",
					},
					quantity: 2,
				}),
			]),
		);
	});

	it("rejects an exact start stack larger than the canonical max stack size", () => {
		const result = Effect.runSync(
			Effect.result(
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
						jobQueue: [],

						defaultLineByOwnerItemId: {},
					},
					start: {
						currentSpace: 0,
						board: [
							{
								itemId: "log",
								quantity: 4,
								space: 0,
								x: 0,
								y: 0,
							},
						],
						inventory: [],
						toolbar: [],
					},
				}),
			).pipe(
				useGameFx({
					config: startTestConfig,
				}),
			),
		);

		expect(Result.isFailure(result)).toBe(true);
		if (Result.isFailure(result)) {
			expect(result.failure).toMatchObject({
				_tag: "StartSlotUnavailableError",
				itemId: "log",
				remainingQuantity: 1,
				scope: "board",
			});
		}
	});

	it("rejects conflicting exact board locations", () => {
		const result = Effect.runSync(
			Effect.result(
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

						jobQueue: [],
						defaultLineByOwnerItemId: {},
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
						toolbar: [],
					},
				}),
			).pipe(
				useGameFx({
					config: startTestConfig,
				}),
			),
		);

		expect(Result.isFailure(result)).toBe(true);
		if (Result.isFailure(result)) {
			expect(result.failure).toMatchObject({
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

	it("rejects two eligible start items claiming the same exact toolbar slot", () => {
		const result = Effect.runSync(
			Effect.result(
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
						jobQueue: [],

						defaultLineByOwnerItemId: {},
					},
					start: {
						currentSpace: 0,
						board: [],
						inventory: [],
						toolbar: [
							{
								itemId: "backpack",
								position: {
									x: 0,
									y: 0,
								},
							},
							{
								itemId: "log",
								position: {
									x: 0,
									y: 0,
								},
							},
						],
					},
				}),
			).pipe(
				useGameFx({
					config: startTestConfig,
				}),
			),
		);

		expect(Result.isFailure(result)).toBe(true);
		if (Result.isFailure(result)) {
			expect(result.failure).toMatchObject({
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
