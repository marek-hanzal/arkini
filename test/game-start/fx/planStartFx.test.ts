import { Effect, Result } from "effect";
import { describe, expect, it } from "vitest";

import { useGameFx } from "~test/support/useGameFx";
import { startTestConfig } from "~test/game-start/support/startTestConfig";
import { planStartFx } from "~/game-start/fx/planStartFx";
import { RuntimeCheckIssueEnumSchema } from "~/game-runtime/schema/RuntimeCheckIssueEnumSchema";

describe("planStartFx", () => {
	it("rejects an exact start stack larger than the canonical max stack size", () => {
		const result = Effect.runSync(
			Effect.result(
				planStartFx({
					runtime: {
						cheats: {
							enabled: false,
							everEnabled: false,
							speedUpGameplay: false,
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
							speedUpGameplay: false,
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
