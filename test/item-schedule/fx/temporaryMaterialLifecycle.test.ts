import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { advanceRuntimeStepFx } from "~/game-tick/fx/advanceRuntimeStepFx";
import { projectCommittedEngineFactsFx } from "~/game-event/fx/projectCommittedEngineFactsFx";
import type { EngineFact } from "~/game-event/type/EngineFact";
import { GameEventEnumSchema } from "~/game-event/schema/GameEventEnumSchema";
import { readRuntimeFx } from "~/game-runtime/fx/readRuntimeFx";
import type { RuntimeSchema } from "~/game-runtime/schema/RuntimeSchema";
import { bufferInputMaterialForTestFx } from "~test/support/bufferInputMaterialForTestFx";
import { startLineFx } from "~test/production-job/support/startLineTestFx";
import { runTickRuntimeByFx } from "~test/game-tick/support/runTickRuntimeByFx";
import { spawnItemFx } from "~test/support/spawnItemFx";
import { useGameFx } from "~test/support/useGameFx";
import { createTemporaryMaterialLifecycleTestConfig } from "~test/item-schedule/fx/temporaryMaterialLifecycle.test/createTemporaryMaterialLifecycleTestConfig";

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
	const facts: EngineFact[] = [];
	for (let index = 0; index < count; index += 1) {
		const step = yield* advanceRuntimeStepFx(draft);
		draft = step.runtime;
		facts.push(...step.facts);
	}
	return {
		events: yield* projectCommittedEngineFactsFx({
			previousRuntime: runtime,
			runtime: draft,
			facts,
		}),
		runtime: draft,
	};
});

const spawnOwnerFx = Effect.fn("spawnTemporaryMaterialTestOwnerFx")(function* () {
	return yield* spawnItemFx({
		id: "runtime:owner",
		itemUid: "owner",
		location: board(0),
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
		itemUid: "temporary",
		location: board(x),
	});
});

const storeTemporaryFx = Effect.fn("storeTemporaryMaterialTestItemFx")(function* ({
	id,
	revision,
}: {
	readonly id: string;
	readonly revision: string;
}) {
	yield* bufferInputMaterialForTestFx({
		ownerItemId: "runtime:owner",
		lineId: "line:owner",
		inputIndex: 0,
		sourceItemId: id,
		sourceItemRevision: revision,
	});
});

describe("temporary material lifecycle", () => {
	it("aborts a job when one committed Clock material expires", () => {
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
				const completed = yield* advanceStepsFx({
					count: 6,
					runtime: continued.runtime,
				});
				return {
					completed,
					continued,
				};
			}).pipe(
				useGameFx({
					config: createTemporaryMaterialLifecycleTestConfig(),
				}),
			),
		);
		expect(result.continued.runtime.jobs).toEqual([]);
		expect(result.continued.runtime.items.some((item) => item.item.uid === "temporary")).toBe(
			false,
		);
		expect(
			result.continued.events.some(
				(event) => event.type === GameEventEnumSchema.enum.JobAborted,
			),
		).toBe(true);
		expect(
			result.continued.events.some(
				(event) => event.type === GameEventEnumSchema.enum.ItemDisappeared,
			),
		).toBe(false);
		expect(result.completed.runtime.jobs).toEqual([]);
		expect(result.completed.runtime.items.some((item) => item.item.uid === "product")).toBe(
			false,
		);
		expect(result.completed.runtime.items.some((item) => item.item.uid === "residue")).toBe(
			true,
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
		expect(runtime.runtime.items.some((item) => item.item.uid === "product")).toBe(true);
		expect(runtime.runtime.items.some((item) => item.item.uid === "residue")).toBe(false);
		expect(
			runtime.events.some((event) => event.type === GameEventEnumSchema.enum.ItemExpired),
		).toBe(false);
	});

	it("keeps committed expiry atomic when its outcome has no Board capacity", () => {
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
					itemUid: "blocker",
					location: board(1),
				});
				yield* spawnItemFx({
					id: "runtime:blocker:two",
					itemUid: "blocker",
					location: board(2),
				});
				const blocked = yield* advanceStepsFx({
					count: 6,
					runtime: yield* readRuntimeFx(),
				});
				const stillBlocked = yield* advanceStepsFx({
					count: 2,
					runtime: blocked.runtime,
				});
				return {
					blocked,
					stillBlocked,
				};
			}).pipe(
				useGameFx({
					config: createTemporaryMaterialLifecycleTestConfig(),
				}),
			),
		);

		expect(result.blocked.runtime.jobs).toEqual([
			expect.objectContaining({
				remainingMs: 400,
			}),
		]);
		expect(result.stillBlocked.runtime.jobs).toEqual([
			expect.objectContaining({
				remainingMs: 400,
			}),
		]);
		expect(result.stillBlocked.runtime.items).toContainEqual(
			expect.objectContaining({
				id: "runtime:temporary",
				schedule: {
					remainingDurationMs: 0,
				},
			}),
		);
		expect(result.stillBlocked.runtime.items.some((item) => item.item.uid === "residue")).toBe(
			false,
		);
	});
});
