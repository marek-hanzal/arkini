import { Effect } from "effect";
import { expect, it } from "vitest";
import { resolveActionUnitsInputFx } from "~/production-action/fx/resolveActionUnitsInputFx";
import { readRuntimeFx } from "~/game-runtime/fx/readRuntimeFx";
import { spawnItemFx } from "~test/support/spawnItemFx";
import { useGameFx } from "~test/support/useGameFx";
import { unitsConfig } from "./itemUnits.test/fixture";

it("selects local universe unit payers before remote spaces and orders remote cells deterministically", () => {
	const result = Effect.runSync(
		Effect.gen(function* () {
			yield* spawnItemFx({
				id: "owner",
				itemId: "producer:double-target",
				quantity: 1,
				location: {
					scope: "board",
					space: 0,
					position: {
						x: 0,
						y: 0,
					},
				},
			});
			for (const [id, space, x, y] of [
				[
					"remote-last",
					2,
					0,
					0,
				],
				[
					"remote-next",
					1,
					0,
					1,
				],
				[
					"remote-first",
					1,
					3,
					0,
				],
				[
					"local",
					0,
					3,
					1,
				],
			] as const) {
				yield* spawnItemFx({
					id,
					itemId: "units:tree",
					quantity: 1,
					location: {
						scope: "board",
						space,
						position: {
							x,
							y,
						},
					},
				});
			}
			const runtime = yield* readRuntimeFx();
			const selected: string[] = [];
			const reservedUnits = new Map<string, number>();
			for (let index = 0; index < 4; index++) {
				const result = yield* resolveActionUnitsInputFx({
					ownerItemId: "owner",
					reservedUnits,
					runtime,
					input: {
						type: "units",
						query: {
							distance: "universe",
							selector: {
								type: "item",
								itemId: "units:tree",
							},
						},
						units: {
							from: "target",
							cost: 1,
						},
					},
				});
				if (
					result.resolution.type !== "units" ||
					!result.resolution.ready ||
					result.resolution.targetItemId === undefined
				)
					throw new Error("Expected a payer");
				selected.push(result.resolution.targetItemId);
				reservedUnits.set(result.resolution.targetItemId, 100);
			}
			return selected;
		}).pipe(
			useGameFx({
				config: unitsConfig,
			}),
		),
	);
	expect(result).toEqual([
		"local",
		"remote-first",
		"remote-next",
		"remote-last",
	]);
});
