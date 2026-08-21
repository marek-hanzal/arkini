import { Effect, Result } from "effect";
import { describe, expect, it } from "vitest";

import { useGameFx } from "~/engine/game/fx/useGameFx";
import { GameConfigSchema } from "~/engine/schema/GameConfigSchema";
import { startTestConfig } from "~test/start/fx/support/startTestConfig";
import { planStartInventoryItemFx } from "~/engine/start/fx/planStartInventoryItemFx";

describe("planStartInventoryItemFx", () => {
	it("splits the complete quantity into deterministic inventory stacks", () => {
		const plan = Effect.runSync(
			planStartInventoryItemFx({
				item: {
					itemId: "log",
					quantity: 4,
				},
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
			}).pipe(
				useGameFx({
					config: startTestConfig,
				}),
			),
		);

		expect(
			plan.spawn.map(({ item }) => ({
				location: item.location,
				quantity: item.quantity,
			})),
		).toEqual([
			{
				location: {
					position: {
						x: 0,
						y: 0,
					},
					scope: "inventory",
				},
				quantity: 3,
			},
			{
				location: {
					position: {
						x: 1,
						y: 0,
					},
					scope: "inventory",
				},
				quantity: 1,
			},
		]);
	});

	it("fails instead of returning a partial initial inventory plan", () => {
		const config = GameConfigSchema.parse({
			...startTestConfig,
			meta: {
				...startTestConfig.meta,
				inventory: {
					width: 1,
					height: 1,
				},
			},
		});
		const result = Effect.runSync(
			Effect.result(
				planStartInventoryItemFx({
					item: {
						itemId: "log",
						quantity: 4,
					},
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
				}),
			).pipe(
				useGameFx({
					config,
				}),
			),
		);

		expect(Result.isFailure(result)).toBe(true);
		if (Result.isFailure(result)) {
			expect(result.failure).toMatchObject({
				_tag: "StartInventoryUnavailableError",
				itemId: "log",
				quantity: 4,
				remainingQuantity: 1,
			});
		}
	});
});
