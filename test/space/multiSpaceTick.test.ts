import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { useGameFx } from "~/engine/game/fx/useGameFx";
import { startLineFx } from "~/engine/job/write/startLineFx";
import { readRuntimeFx } from "~/engine/runtime/read/readRuntimeFx";
import { spawnItemFx } from "~/engine/runtime/write/spawnItemFx";
import { runTickRuntimeByFx } from "~/engine/tick/fx/runTickRuntimeByFx";
import { boardLocation, multiSpaceTestConfig } from "~test/space/support/multiSpaceTestConfig";

describe("multi-space simulation", () => {
	it("completes active jobs outside the presented space", () => {
		const runtime = Effect.runSync(
			Effect.gen(function* () {
				const worker = yield* spawnItemFx({
					id: "runtime:worker",
					itemId: "worker",
					location: boardLocation(2, 0),
					quantity: 1,
				});
				yield* startLineFx({
					ownerItemId: worker.id,
					lineId: "line:worker:run",
				});
				yield* runTickRuntimeByFx({
					elapsedMs: 200,
				});
				return yield* readRuntimeFx();
			}).pipe(
				useGameFx({
					config: multiSpaceTestConfig,
				}),
			),
		);

		expect(runtime.currentSpace).toBe(0);
		expect(runtime.jobs).toEqual([]);
		expect(
			runtime.items.some(
				(item) =>
					item.item.id === "log" &&
					item.location.scope === "board" &&
					item.location.space === 2,
			),
		).toBe(true);
		expect(
			runtime.items.some(
				(item) =>
					item.item.id === "log" &&
					item.location.scope === "board" &&
					item.location.space === 0,
			),
		).toBe(false);
	});

	it("ages and expires temporary items outside the presented space", () => {
		const runtime = Effect.runSync(
			Effect.gen(function* () {
				yield* spawnItemFx({
					id: "runtime:temporary",
					itemId: "temporary",
					location: boardLocation(3, 1),
					quantity: 1,
				});
				yield* runTickRuntimeByFx({
					elapsedMs: 600,
				});
				return yield* readRuntimeFx();
			}).pipe(
				useGameFx({
					config: multiSpaceTestConfig,
				}),
			),
		);

		expect(runtime.currentSpace).toBe(0);
		expect(runtime.items.some((item) => item.id === "runtime:temporary")).toBe(false);
		expect(
			runtime.items.some(
				(item) =>
					item.item.id === "log" &&
					item.location.scope === "board" &&
					item.location.space === 3,
			),
		).toBe(true);
	});
});
