import { Effect } from "effect";
import { expect, it } from "vitest";
import { useGameFx } from "~test/support/useGameFx";
import { startTestConfig } from "~test/game-start/support/startTestConfig";
import { planStartFx } from "~/game-start/fx/planStartFx";
import { startFx } from "~/game-start/fx/startFx";

it("applies templates through replacement rather than stacking initial items", () => {
	const { first, next } = Effect.runSync(
		Effect.gen(function* () {
			const first = yield* startFx();
			const next = yield* planStartFx({
				runtime: first,
				start: startTestConfig.start,
			});
			return {
				first,
				next: next.runtime,
			};
		}).pipe(
			useGameFx({
				config: startTestConfig,
			}),
		),
	);
	expect(next.items).toHaveLength(first.items.length);
	expect(next.items[0]?.id).not.toBe(first.items[0]?.id);
	expect(next.items[0]?.location).toEqual(first.items[0]?.location);
	expect(next.templateUidBySpace).toEqual({
		0: "start",
	});
});
