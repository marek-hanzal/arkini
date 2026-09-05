import { Effect } from "effect";
import { expect, it } from "vitest";

import { validateGameConfigFx } from "~/game-config-validation/fx/validateGameConfigFx";
import { readRuntimeFx } from "~/game-runtime/fx/readRuntimeFx";
import { enqueueLineFx } from "~/production-job/fx/enqueueLineFx";
import { runTickRuntimeByFx } from "~test/game-tick/support/runTickRuntimeByFx";
import { startLineFx } from "~test/production-job/support/startLineTestFx";
import { spawnItemFx } from "~test/support/spawnItemFx";
import { useGameFx } from "~test/support/useGameFx";
import { createConfig, type OutputPath } from "./conditionalOutputReplay.test/fixture";

const run = (path: OutputPath, steps: readonly number[], markerDuration = 500) => {
	const config = createConfig(path, markerDuration);
	return Effect.runSync(
		Effect.gen(function* () {
			expect(
				yield* validateGameConfigFx({
					config,
					provenance: {
						items: {},
					},
				}),
			).toEqual([]);
			const itemIds = [
				"temporaryPlain",
				path === "expiry" ? "temporaryOutput" : "producer",
			];
			if (path === "immediate-depletion") itemIds.push("payer");
			for (const [x, itemId] of itemIds.entries()) {
				yield* spawnItemFx({
					id: `runtime:${x}`,
					itemId,
					quantity: 1,
					location: {
						scope: "board",
						space: 0,
						position: {
							x,
							y: 0,
						},
					},
				});
			}
			if (path !== "expiry")
				yield* startLineFx({
					ownerItemId: "runtime:1",
					lineId: "line:producer:temporary",
				});
			if (path === "immediate-depletion")
				yield* enqueueLineFx({
					ownerItemId: "runtime:1",
					lineId: "spend",
				});
			for (const elapsedMs of steps)
				yield* runTickRuntimeByFx({
					elapsedMs,
				});
			return (yield* readRuntimeFx()).items.map((item) => item.item.id).sort();
		}).pipe(
			useGameFx({
				config,
			}),
		),
	);
};

it.each<OutputPath>([
	"expiry",
	"line",
	"deferred-depletion",
	"immediate-depletion",
])("%s output conditions see earlier fixed steps regardless of Tick batching", (path) => {
	const split = run(
		path,
		[
			500,
			100,
		],
	);
	expect(split).toContain("result");
	expect(
		run(
			path,
			[
				600,
			],
		),
	).toEqual(split);
});

it("later expiry sees earlier stable-ID expiry output within the same fixed step", () => {
	expect(
		run(
			"expiry",
			[
				600,
			],
			600,
		),
	).toEqual([
		"blocker",
		"result",
	]);
});
