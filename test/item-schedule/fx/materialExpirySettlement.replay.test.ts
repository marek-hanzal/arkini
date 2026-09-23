import { Effect, Random } from "effect";
import { describe, expect, it } from "vitest";
import { readRuntimeFx } from "~/game-runtime/fx/readRuntimeFx";
import { attemptScheduledItemExpiryFx } from "~/item-schedule/fx/attemptScheduledItemExpiryFx";
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

describe("aborted job depletion replay", () => {
	it.each([
		"loose-kill",
		"kill-switch",
	] as const)("replays random placement from the same snapshot under %s", (mode) => {
		const config = lastUnitConfigFn(mode);
		const roll = config.items.owner!.units!.outcome!.set[0]!.roll[0]!;
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
				const first = yield* attemptScheduledItemExpiryFx({
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
				const constrained = yield* attemptScheduledItemExpiryFx({
					itemId: "input",
					runtime: full,
				});
				const restored = RuntimeSchema.parse(JSON.parse(JSON.stringify(ready)));
				const replay = yield* attemptScheduledItemExpiryFx({
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
		expect(result.first.type).toBe("expired");
		expect(result.replay.type).toBe("expired");
		expect(outputLocationsFn(result.first.runtime)).toHaveLength(2);
		if (mode === "loose-kill") {
			expect(result.constrained.type).toBe("blocked");
			expect(result.constrained.runtime).toBe(result.full);
		} else {
			expect(result.constrained.type).toBe("expired");
			if (result.constrained.type !== "expired") throw new Error("Expected forced expiry");
			expect(outputLocationsFn(result.constrained.runtime)).toHaveLength(1);
			expect(result.constrained.runtime.jobs).toEqual([]);
			expect(result.constrained.runtime.items.some((item) => item.id === "owner")).toBe(
				false,
			);
			expect(result.constrained.facts).toContainEqual(
				expect.objectContaining({
					type: "item:discarded",
					source: "depletion-outcome",
					quantity: 1,
					reason: "board:full",
				}),
			);
		}
		expect(outputLocationsFn(result.replay.runtime)).toEqual(
			outputLocationsFn(result.first.runtime),
		);
	});
});
