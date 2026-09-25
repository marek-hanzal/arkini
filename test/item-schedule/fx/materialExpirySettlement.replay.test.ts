import { Effect, Random } from "effect";
import { describe, expect, it } from "vitest";
import { readRuntimeFx } from "~/game-runtime/fx/readRuntimeFx";
import { attemptTerminalItemFx } from "~/item-terminal/fx/attemptTerminalItemFx";
import { RuntimeSchema } from "~/game-runtime/schema/RuntimeSchema";
import { useGameFx } from "~test/support/useGameFx";
import { makeFixedRandomFx } from "~test/support/makeFixedRandomFx";
import { spawnItemFx } from "~test/support/spawnItemFx";
import {
	startMaterialJobFx,
	lastUnitConfigFn,
	boardFn,
} from "./materialExpirySettlement.test/fixture";

// Compare exact outcome locations while leaving fresh runtime identity generation opaque.
const outputLocationsFn = (runtime: RuntimeSchema.Type) =>
	runtime.items.filter((item) => item.item.uid === "residue").map((item) => item.location);

describe("internal item termination replay", () => {
	it("replays random placement from the same snapshot after a blocked loose-kill attempt", () => {
		const config = lastUnitConfigFn("loose-kill");
		const outcome = config.items.owner!.lines.find(
			(line) => line.trigger === "item-termination",
		)!.outcome!;
		config.items.temporary!.lines[0]!.outcome = outcome;
		const roll = outcome.set[0]!.roll[0]!;
		if (roll.type !== "guaranteed") throw new Error("Expected guaranteed fixture outcome");
		const drop = roll.outcome[0]!;
		if (drop.type !== "item") throw new Error("Expected Item outcome fixture");
		drop.placement = "random";
		drop.quantity = {
			min: 2,
			max: 2,
		};
		const result = Effect.runSync(
			Effect.gen(function* () {
				yield* startMaterialJobFx();
				const started = yield* readRuntimeFx();
				const ready = {
					...started,
					items: started.items.map((item) =>
						item.id === "input"
							? {
									...item,
									schedule: {
										remainingDurationMs: 0,
									},
								}
							: item,
					),
				};
				const first = yield* attemptTerminalItemFx({
					itemId: "input",
					runtime: ready,
				}).pipe(
					Effect.provideServiceEffect(
						Random.Random,
						makeFixedRandomFx([
							0.01,
						]),
					),
				);
				for (const x of [
					1,
					2,
				])
					yield* spawnItemFx({
						id: `blocker:${x}`,
						itemUid: "blocker",

						location: boardFn(x),
					});
				const full = {
					...ready,
					items: [
						...ready.items,
						...(yield* readRuntimeFx()).items.filter(
							(item) => item.item.uid === "blocker",
						),
					],
				};
				const constrained = yield* attemptTerminalItemFx({
					itemId: "input",
					runtime: full,
				});
				const restored = RuntimeSchema.parse(JSON.parse(JSON.stringify(ready)));
				const replay = yield* attemptTerminalItemFx({
					itemId: "input",
					runtime: restored,
				}).pipe(
					Effect.provideServiceEffect(
						Random.Random,
						makeFixedRandomFx([
							0.99,
						]),
					),
				);
				return {
					first,
					replay,
					constrained,
					full,
				};
			}).pipe(
				useGameFx({
					config,
				}),
			),
		);
		expect(result.first.type).toBe("settled");
		expect(result.replay.type).toBe("settled");
		expect(outputLocationsFn(result.first.runtime)).toHaveLength(2);
		expect(result.constrained.type).toBe("blocked");
		expect(result.constrained.runtime).toBe(result.full);
		expect(outputLocationsFn(result.replay.runtime)).toEqual(
			outputLocationsFn(result.first.runtime),
		);
	});
});
