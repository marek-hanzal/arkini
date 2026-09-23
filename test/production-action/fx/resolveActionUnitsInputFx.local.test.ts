import { Effect } from "effect";
import { expect, it } from "vitest";
import { resolveActionUnitsInputFx } from "~/production-action/fx/resolveActionUnitsInputFx";
import { readRuntimeFx } from "~/game-runtime/fx/readRuntimeFx";
import { spawnItemFx } from "~test/support/spawnItemFx";
import { useGameFx } from "~test/support/useGameFx";
import { unitsConfig } from "./itemUnits.test/fixture";

it.each([
	0,
	1,
])("limits far unit payers to owner space %i regardless of the viewed space", (ownerSpace) => {
	const result = Effect.runSync(
		Effect.gen(function* () {
			yield* spawnItemFx({
				id: "owner",
				itemUid: "producer:double-target",

				location: {
					scope: "board",
					space: ownerSpace,
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
					2,
					0,
					1,
				],
				[
					"remote-first",
					2,
					3,
					0,
				],
				[
					"local",
					ownerSpace,
					3,
					1,
				],
			] as const) {
				yield* spawnItemFx({
					id,
					itemUid: "units:tree",

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
			const runtime = {
				...(yield* readRuntimeFx()),
				currentSpace: 0,
			};
			const selected: string[] = [];
			const reservedUnits = new Map<string, number>();
			for (let index = 0; index < 2; index++) {
				const result = yield* resolveActionUnitsInputFx({
					ownerItemId: "owner",
					reservedUnits,
					runtime,
					input: {
						type: "units",
						query: {
							distance: "far",
							selector: {
								type: "item",
								itemUid: "units:tree",
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
				) {
					expect(result.plan).toBeUndefined();
					selected.push("unavailable");
					continue;
				}
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
		"unavailable",
	]);
});
