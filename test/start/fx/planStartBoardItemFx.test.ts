import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { useGameFx } from "~/v1/game/fx/useGameFx";
import { startTestConfig } from "~test/start/fx/support/startTestConfig";
import { planStartBoardItemFx } from "~/v1/start/fx/planStartBoardItemFx";

describe("planStartBoardItemFx", () => {
	it("plans one exact board spawn without fallback", () => {
		const plan = Effect.runSync(
			planStartBoardItemFx({
				item: {
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
