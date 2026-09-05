import { Effect } from "effect";
import { expect, it } from "vitest";

import { board } from "~test/production-action/fx/itemCharges.test/fixture";
import { createConfig } from "./queuedChargePayer.test/fixture";
import { waitFor } from "~test/game-session/fx/createGameSession.test/fixture";
import { createTestGameSession } from "~test/support/createTestGameSession";
import { spawnItemFx } from "~test/support/spawnItemFx";
import { useGameFx } from "~test/support/useGameFx";
import { validateGameConfigFx } from "~/game-config-validation/fx/validateGameConfigFx";
import { fromRuntimeFn } from "~/game-persistence/fn/fromRuntimeFn";
import { readRuntimeFx } from "~/game-runtime/fx/readRuntimeFx";
import { advanceRuntimeElapsedFx } from "~/game-tick/fx/advanceRuntimeElapsedFx";
import { clearItemJobQueueFx } from "~/production-job/fx/clearItemJobQueueFx";
import { enqueueLineFx } from "~/production-job/fx/enqueueLineFx";

it("keeps a queued final-charge payer intact without freezing the session, then retries after queue clearing", async () => {
	const config = createConfig();
	const state = Effect.runSync(
		Effect.gen(function* () {
			const diagnostics = yield* validateGameConfigFx({
				config,
				provenance: {
					items: {},
				},
			});
			expect(diagnostics.filter((diagnostic) => diagnostic.severity === "error")).toEqual([]);
			for (const [id, x] of [
				[
					"consumer",
					0,
				],
				[
					"payer",
					1,
				],
				[
					"independent",
					3,
				],
			] as const) {
				yield* spawnItemFx({
					id,
					itemId: id,
					location: board(x),
					quantity: 1,
				});
			}
			yield* enqueueLineFx({
				ownerItemId: "consumer",
				lineId: "work",
			});
			yield* enqueueLineFx({
				ownerItemId: "payer",
				lineId: "wait",
			});
			yield* enqueueLineFx({
				ownerItemId: "independent",
				lineId: "free",
			});
			return fromRuntimeFn({
				runtime: yield* readRuntimeFx(),
			});
		}).pipe(
			useGameFx({
				config,
			}),
		),
	);
	const session = await createTestGameSession({
		config,
		state,
		tickIntervalMs: 5,
	});
	try {
		await waitFor(
			() =>
				session.getSnapshotFn().jobs.some((job) => job.ownerItemId === "independent") ||
				session.getFatalErrorFn() !== null,
		);
		expect(session.getFatalErrorFn()).toBeNull();
		const blocked = session.getSnapshotFn();
		expect(blocked.jobs.map((job) => job.ownerItemId)).toEqual([
			"independent",
		]);
		expect(blocked.jobQueue).toEqual(
			state.jobQueue.filter((request) => request.ownerItemId !== "independent"),
		);
		expect(
			fromRuntimeFn({
				runtime: blocked,
			}).items.find((item) => item.id === "payer"),
		).toEqual(state.items.find((item) => item.id === "payer"));
		await session.runFn(
			clearItemJobQueueFx({
				ownerItemId: "payer",
			}),
		);
		await waitFor(
			() =>
				session.getSnapshotFn().jobs.some((job) => job.ownerItemId === "consumer") ||
				session.getFatalErrorFn() !== null,
		);
		expect(session.getFatalErrorFn()).toBeNull();
		expect(session.getSnapshotFn().items.some((item) => item.id === "payer")).toBe(false);
		expect(session.getSnapshotFn().jobs.map((job) => job.ownerItemId)).toEqual([
			"independent",
			"consumer",
		]);
	} finally {
		await Effect.runPromise(session.disposeWithoutSaveFx);
	}
});

it("counts earlier target costs and uses an alternate payer before depleting a queued identity", () => {
	Effect.runSync(
		Effect.gen(function* () {
			for (const [id, itemId, x, y] of [
				[
					"consumer",
					"consumer",
					0,
					0,
				],
				[
					"queued",
					"payer",
					1,
					0,
				],
				[
					"alternate",
					"payer",
					0,
					1,
				],
			] as const) {
				yield* spawnItemFx({
					id,
					itemId,
					location: board(x, y),
					quantity: 1,
				});
			}
			yield* enqueueLineFx({
				ownerItemId: "consumer",
				lineId: "work",
			});
			yield* enqueueLineFx({
				ownerItemId: "queued",
				lineId: "wait",
			});
			const before = yield* readRuntimeFx();
			yield* advanceRuntimeElapsedFx({
				elapsedMs: 100,
			});
			const after = yield* readRuntimeFx();
			expect(after.jobs.map((job) => job.ownerItemId)).toEqual([
				"consumer",
			]);
			expect(after.jobQueue).toEqual(
				before.jobQueue.filter((request) => request.ownerItemId === "queued"),
			);
			expect(after.items.find((item) => item.id === "queued")).toMatchObject({
				remainingCharges: 1,
			});
			expect(after.items.find((item) => item.id === "alternate")).toMatchObject({
				remainingCharges: 1,
			});
		}).pipe(
			useGameFx({
				config: createConfig(2, 2),
			}),
		),
	);
});

it("lets a self-targeted final charge start while the same owner still has queued work", () => {
	Effect.runSync(
		Effect.gen(function* () {
			yield* spawnItemFx({
				id: "payer",
				itemId: "payer",
				location: board(0),
				quantity: 1,
			});
			yield* enqueueLineFx({
				ownerItemId: "payer",
				lineId: "self",
			});
			yield* enqueueLineFx({
				ownerItemId: "payer",
				lineId: "wait",
			});
			yield* advanceRuntimeElapsedFx({
				elapsedMs: 100,
			});
			const runtime = yield* readRuntimeFx();
			expect(runtime.items[0]).toMatchObject({
				id: "payer",
				remainingCharges: 0,
			});
			expect(runtime.jobs[0]).toMatchObject({
				ownerItemId: "payer",
				lineId: "self",
			});
			expect(runtime.jobQueue[0]).toMatchObject({
				ownerItemId: "payer",
				lineId: "wait",
			});
		}).pipe(
			useGameFx({
				config: createConfig(),
			}),
		),
	);
});

it("retains an active external payer at zero charges until its job completes", () => {
	Effect.runSync(
		Effect.gen(function* () {
			yield* spawnItemFx({
				id: "consumer",
				itemId: "consumer",
				location: board(0),
				quantity: 1,
			});
			yield* spawnItemFx({
				id: "payer",
				itemId: "payer",
				location: board(1),
				quantity: 1,
			});
			yield* enqueueLineFx({
				ownerItemId: "payer",
				lineId: "free",
			});
			yield* advanceRuntimeElapsedFx({
				elapsedMs: 100,
			});
			yield* enqueueLineFx({
				ownerItemId: "payer",
				lineId: "wait",
			});
			yield* enqueueLineFx({
				ownerItemId: "consumer",
				lineId: "work",
			});
			yield* advanceRuntimeElapsedFx({
				elapsedMs: 100,
			});
			const runtime = yield* readRuntimeFx();
			expect(runtime.items.find((item) => item.id === "payer")).toMatchObject({
				remainingCharges: 0,
			});
			expect(runtime.jobs.map((job) => job.ownerItemId)).toEqual([
				"payer",
				"consumer",
			]);
			expect(runtime.jobQueue[0]).toMatchObject({
				ownerItemId: "payer",
				lineId: "wait",
			});
		}).pipe(
			useGameFx({
				config: createConfig(),
			}),
		),
	);
});
