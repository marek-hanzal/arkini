import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { useGameFx } from "~/engine/game/fx/useGameFx";
import { planStartToolbarItemFx } from "~/engine/start/fx/planStartToolbarItemFx";
import { startTestConfig } from "~test/start/fx/support/startTestConfig";

describe("planStartToolbarItemFx", () => {
	it("plans one exact toolbar spawn without fallback", () => {
		const plan = Effect.runSync(
			planStartToolbarItemFx({
				item: {
					itemId: "backpack",
					position: {
						x: 1,
						y: 0,
					},
				},
			}).pipe(
				useGameFx({
					config: startTestConfig,
				}),
			),
		);

		expect(plan.remove).toEqual([]);
		expect(plan.stack).toEqual([]);
		expect(plan.spawn).toEqual([
			expect.objectContaining({
				item: expect.objectContaining({
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
			}),
		]);
	});
});
