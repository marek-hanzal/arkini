import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { advanceRuntimeStepFx } from "~/game-tick/fx/advanceRuntimeStepFx";
import { GameEventEnumSchema } from "~/game-event/schema/GameEventEnumSchema";
import { readRuntimeFx } from "~/game-runtime/fx/readRuntimeFx";
import { removeRuntimeItemIdentityFx } from "~/game-runtime/fx/removeRuntimeItemIdentityFx";
import type { RuntimeSchema } from "~/game-runtime/schema/RuntimeSchema";
import { storeInputMaterialFx } from "~/production-input/fx/storeInputMaterialFx";
import { startLineFx } from "~test/production-job/support/startLineTestFx";
import { runTickRuntimeByFx } from "~test/game-tick/support/runTickRuntimeByFx";
import { spawnItemFx } from "~test/support/spawnItemFx";
import { useGameFx } from "~test/support/useGameFx";
import { createTemporaryMaterialLifecycleTestConfig } from "~test/temporary-item/fx/temporaryMaterialLifecycle.test/createTemporaryMaterialLifecycleTestConfig";

const board = (x: number) => ({
	scope: "board" as const,
	space: 0,
	position: {
		x,
		y: 0,
	},
});

const advanceStepsFx = Effect.fn("advanceTemporaryMaterialTestStepsFx")(function* ({
	count,
	runtime,
}: {
	readonly count: number;
	readonly runtime: RuntimeSchema.Type;
}) {
	let draft = runtime;
	const events = [];
	for (let index = 0; index < count; index += 1) {
		const step = yield* advanceRuntimeStepFx(draft);
		draft = step.runtime;
		events.push(...step.events);
	}
	return {
		events,
		runtime: draft,
	};
});

const spawnOwnerFx = Effect.fn("spawnTemporaryMaterialTestOwnerFx")(function* () {
	return yield* spawnItemFx({
		id: "runtime:owner",
		itemId: "owner",
		location: board(0),
		quantity: 1,
	});
});

const spawnTemporaryFx = Effect.fn("spawnTemporaryMaterialTestItemFx")(function* ({
	id,
	x,
}: {
	readonly id: string;
	readonly x: number;
}) {
	return yield* spawnItemFx({
		id,
		itemId: "temporary",
		location: board(x),
		quantity: 1,
	});
});

const storeTemporaryFx = Effect.fn("storeTemporaryMaterialTestItemFx")(function* ({
	id,
	revision,
}: {
	readonly id: string;
	readonly revision: string;
}) {
	yield* storeInputMaterialFx({
		ownerItemId: "runtime:owner",
		lineId: "line:owner",
		inputIndex: 0,
		sourceItemId: id,
		sourceItemRevision: revision,
		quantity: 1,
	});
});

describe("temporary material lifecycle", () => {
	it("keeps a job running while its material minimum remains and aborts it after the last expiry", () => {
		const result = Effect.runSync(
			Effect.gen(function* () {
				yield* spawnOwnerFx();
				const older = yield* spawnTemporaryFx({
					id: "runtime:temporary:older",
					x: 1,
				});
				yield* runTickRuntimeByFx({
					elapsedMs: 200,
				});
				const younger = yield* spawnTemporaryFx({
					id: "runtime:temporary:younger",
					x: 2,
				});
				yield* storeTemporaryFx(older);
				yield* storeTemporaryFx(younger);
				yield* startLineFx({
					ownerItemId: "runtime:owner",
					lineId: "line:owner",
				});
				const continued = yield* advanceStepsFx({
					count: 4,
					runtime: yield* readRuntimeFx(),
				});
				const aborted = yield* advanceStepsFx({
					count: 2,
					runtime: continued.runtime,
				});
				return {
					aborted,
					continued,
				};
			}).pipe(
				useGameFx({
					config: createTemporaryMaterialLifecycleTestConfig(),
				}),
			),
		);

		expect(result.continued.runtime.jobs).toEqual([
			expect.objectContaining({
				remainingMs: 600,
			}),
		]);
		expect(
			result.continued.runtime.items.find((item) => item.id === "runtime:temporary:younger")
				?.location,
		).toEqual({
			scope: "job",
			jobId: result.continued.runtime.jobs[0]?.id,
			inputIndex: 0,
		});
		expect(result.continued.events).toContainEqual(
			expect.objectContaining({
				type: GameEventEnumSchema.enum.ItemExpired,
				itemId: "runtime:temporary:older",
				location: board(0),
			}),
		);
		expect(result.aborted.runtime.jobs).toEqual([]);
		expect(result.aborted.runtime.items.some((item) => item.item.id === "product")).toBe(false);
		expect(result.aborted.runtime.items.some((item) => item.item.id === "temporary")).toBe(
			false,
		);
	});

	it("lets job completion win when the job and its temporary material finish together", () => {
		const runtime = Effect.runSync(
			Effect.gen(function* () {
				yield* spawnOwnerFx();
				const temporary = yield* spawnTemporaryFx({
					id: "runtime:temporary",
					x: 1,
				});
				yield* runTickRuntimeByFx({
					elapsedMs: 200,
				});
				yield* storeTemporaryFx(temporary);
				yield* startLineFx({
					ownerItemId: "runtime:owner",
					lineId: "line:owner",
				});
				return yield* advanceStepsFx({
					count: 4,
					runtime: yield* readRuntimeFx(),
				});
			}).pipe(
				useGameFx({
					config: createTemporaryMaterialLifecycleTestConfig(400),
				}),
			),
		);

		expect(runtime.runtime.jobs).toEqual([]);
		expect(runtime.runtime.items.some((item) => item.item.id === "product")).toBe(true);
		expect(runtime.runtime.items.some((item) => item.item.id === "residue")).toBe(false);
		expect(
			runtime.events.some((event) => event.type === GameEventEnumSchema.enum.ItemExpired),
		).toBe(false);
	});

	it("keeps a blocked internal expiry and its job frozen until the whole abort can commit", () => {
		const result = Effect.runSync(
			Effect.gen(function* () {
				yield* spawnOwnerFx();
				const temporary = yield* spawnTemporaryFx({
					id: "runtime:temporary",
					x: 1,
				});
				yield* storeTemporaryFx(temporary);
				yield* startLineFx({
					ownerItemId: "runtime:owner",
					lineId: "line:owner",
				});
				yield* spawnItemFx({
					id: "runtime:blocker:one",
					itemId: "blocker",
					location: board(1),
					quantity: 1,
				});
				const removableBlocker = yield* spawnItemFx({
					id: "runtime:blocker:two",
					itemId: "blocker",
					location: board(2),
					quantity: 1,
				});
				const blocked = yield* advanceStepsFx({
					count: 6,
					runtime: yield* readRuntimeFx(),
				});
				const stillBlocked = yield* advanceStepsFx({
					count: 2,
					runtime: blocked.runtime,
				});
				const released = yield* removeRuntimeItemIdentityFx({
					item: removableBlocker,
					runtime: stillBlocked.runtime,
				});
				const settled = yield* advanceStepsFx({
					count: 1,
					runtime: released,
				});
				return {
					blocked,
					settled,
					stillBlocked,
				};
			}).pipe(
				useGameFx({
					config: createTemporaryMaterialLifecycleTestConfig(),
				}),
			),
		);

		for (const blocked of [
			result.blocked,
			result.stillBlocked,
		]) {
			expect(blocked.runtime.jobs).toEqual([
				expect.objectContaining({
					remainingMs: 400,
				}),
			]);
			expect(blocked.runtime.items).toContainEqual(
				expect.objectContaining({
					id: "runtime:temporary",
					remainingDurationMs: 0,
				}),
			);
		}
		expect(result.settled.runtime.jobs).toEqual([]);
		expect(result.settled.runtime.items.some((item) => item.id === "runtime:temporary")).toBe(
			false,
		);
		expect(result.settled.runtime.items.some((item) => item.item.id === "residue")).toBe(true);
	});
});
