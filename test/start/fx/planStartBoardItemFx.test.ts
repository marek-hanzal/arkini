import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { useGameFx } from "~/engine/game/fx/useGameFx";
import { startTestConfig } from "~test/start/fx/support/startTestConfig";
import { planStartBoardItemFx } from "~/engine/start/fx/planStartBoardItemFx";

describe("planStartBoardItemFx", () => {
	it("plans one exact board spawn without fallback", () => {
		const plan = Effect.runSync(
			planStartBoardItemFx({
				item: {
					space: 0,
					itemId: "tree",
					x: 2,
					y: 0,
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
					item: startTestConfig.items.tree,
					location: {
						space: 0,
						position: {
							x: 2,
							y: 0,
						},
						scope: "board",
					},
					quantity: 1,
				}),
			}),
		]);
	});
});
