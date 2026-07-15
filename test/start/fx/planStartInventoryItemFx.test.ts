import { Effect, Either } from "effect";
import { describe, expect, it } from "vitest";

import { useGameFx } from "~/v1/game/fx/useGameFx";
import { GameConfigSchema } from "~/v1/schema/GameConfigSchema";
import { startTestConfig } from "~test/start/fx/support/startTestConfig";
import { planStartInventoryItemFx } from "~/v1/start/fx/planStartInventoryItemFx";

describe("planStartInventoryItemFx", () => {
	it("splits the complete quantity into deterministic inventory stacks", () => {
		const plan = Effect.runSync(
			planStartInventoryItemFx({
				item: {
					itemId: "log",
					quantity: 4,
				},
				runtime: {
					session: {
						speedMode: "normal" as const,
					},
					currentSpace: 0,
					items: [],
					jobs: [],
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
			Effect.either(
				planStartInventoryItemFx({
					item: {
						itemId: "log",
						quantity: 4,
					},
					runtime: {
						session: {
							speedMode: "normal" as const,
						},
						currentSpace: 0,
						items: [],
						jobs: [],
					},
				}),
			).pipe(
				useGameFx({
					config,
				}),
			),
		);

		expect(Either.isLeft(result)).toBe(true);
		if (Either.isLeft(result)) {
			expect(result.left).toMatchObject({
				_tag: "StartInventoryUnavailableError",
				itemId: "log",
				quantity: 4,
				remainingQuantity: 1,
			});
		}
	});
});
