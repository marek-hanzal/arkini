import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { useGameFx } from "~/engine/game/fx/useGameFx";
import { startTestConfig } from "~test/start/fx/support/startTestConfig";
import { planStartInventoryItemFx } from "~/engine/start/fx/planStartInventoryItemFx";

describe("planStartInventoryItemFx", () => {
	it("plans one exact inventory stack", () => {
		const plan = Effect.runSync(
			planStartInventoryItemFx({
				item: {
					itemId: "log",
					position: {
						x: 1,
						y: 0,
					},
					quantity: 2,
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
						x: 1,
						y: 0,
					},
					scope: "inventory",
				},
				quantity: 2,
			},
		]);
	});
});
