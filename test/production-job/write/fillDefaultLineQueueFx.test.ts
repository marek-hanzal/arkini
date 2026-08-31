import { Effect, Result } from "effect";
import { describe, expect, it } from "vitest";

import { useGameFx } from "~test/support/game/useGameFx";
import { enqueueDefaultLineFx } from "~/production-job/write/enqueueDefaultLineFx";
import { fillDefaultLineQueueFx } from "~/production-job/write/fillDefaultLineQueueFx";
import { unsetDefaultLineFx } from "~/production-line/write/unsetDefaultLineFx";
import { CommittedTransitionsFx } from "~/game-runtime/context/CommittedTransitionsFx";
import { readRuntimeFx } from "~/game-runtime/fx/readRuntimeFx";
import { spawnItemFx } from "~test/support/runtime/spawnItemFx";
import { GameConfigSchema } from "~/game-config/schema/GameConfigSchema";
import { createJobTestConfig, prepareJobLineFx } from "~test/production-job/support/jobTestConfig";
import { startLineFx } from "~test/production-job/support/startLineTestFx";

const ownerItemId = "runtime:forge";
const lineId = "line:forge:run";

const createDefaultLineConfig = (capacity: number) => {
	const base = createJobTestConfig(capacity);
	const forge = base.items.forge;
	if (forge.type !== "producer") throw new Error("Expected producer fixture.");
	return GameConfigSchema.parse({
		...base,
		items: {
			...base.items,
			forge: {
				...forge,
				lines: forge.lines.map((line) => ({
					...line,
					default: line.id === lineId,
				})),
			},
		},
	});
};

const spawnOwnerFx = spawnItemFx({
	id: ownerItemId,
	itemId: "forge",
	location: {
		scope: "board",
		space: 0,
		position: {
			x: 0,
			y: 0,
		},
	},
	quantity: 1,
});

describe("fillDefaultLineQueueFx", () => {
	it("fills two waiting rows to five in one committed transition", () => {
		const result = Effect.runSync(
			Effect.gen(function* () {
				yield* spawnOwnerFx;
				const first = yield* enqueueDefaultLineFx({
					ownerItemId,
				});
				const second = yield* enqueueDefaultLineFx({
					ownerItemId,
				});
				const before = yield* (yield* CommittedTransitionsFx).read;
				const filled = yield* fillDefaultLineQueueFx({
					ownerItemId,
				});
				const after = yield* (yield* CommittedTransitionsFx).read;
				return {
					after,
					before,
					filled,
					first,
					second,
				};
			}).pipe(
				useGameFx({
					config: createDefaultLineConfig(5),
				}),
			),
		);

		expect(result.filled).toMatchObject({
			capacity: 5,
			lineId,
			used: 5,
		});
		expect(result.filled.added).toHaveLength(3);
		expect(result.after.sequence).toBe(result.before.sequence + 1);
		expect(result.after.runtime.jobQueue).toEqual([
			result.first,
			result.second,
			...result.filled.added,
		]);
		expect(new Set(result.after.runtime.jobQueue?.map((request) => request.id))).toHaveProperty(
			"size",
			5,
		);
	});

	it("keeps an already-full queue as an exact no-op", () => {
		const result = Effect.runSync(
			Effect.gen(function* () {
				yield* spawnOwnerFx;
				const first = yield* fillDefaultLineQueueFx({
					ownerItemId,
				});
				const before = yield* (yield* CommittedTransitionsFx).read;
				const second = yield* fillDefaultLineQueueFx({
					ownerItemId,
				});
				const after = yield* (yield* CommittedTransitionsFx).read;
				return {
					after,
					before,
					first,
					second,
				};
			}).pipe(
				useGameFx({
					config: createDefaultLineConfig(5),
				}),
			),
		);

		expect(result.first.added).toHaveLength(5);
		expect(result.second).toEqual({
			added: [],
			capacity: 5,
			lineId,
			used: 5,
		});
		expect(result.after).toBe(result.before);
	});

	it("counts the active job through the existing generic capacity contract", () => {
		const result = Effect.runSync(
			Effect.gen(function* () {
				yield* prepareJobLineFx();
				yield* startLineFx({
					lineId,
					ownerItemId,
				});
				yield* enqueueDefaultLineFx({
					ownerItemId,
				});
				yield* enqueueDefaultLineFx({
					ownerItemId,
				});
				const filled = yield* fillDefaultLineQueueFx({
					ownerItemId,
				});
				return {
					filled,
					runtime: yield* readRuntimeFx(),
				};
			}).pipe(
				useGameFx({
					config: createDefaultLineConfig(5),
				}),
			),
		);

		expect(result.runtime.jobs).toHaveLength(1);
		expect(result.filled.added).toHaveLength(2);
		expect(result.filled.used).toBe(5);
		expect(result.runtime.jobQueue).toHaveLength(4);
	});

	it("rejects a stale owner default without publishing queue state", () => {
		const result = Effect.runSync(
			Effect.gen(function* () {
				yield* spawnOwnerFx;
				yield* unsetDefaultLineFx({
					ownerItemId,
				});
				const before = yield* (yield* CommittedTransitionsFx).read;
				const attempt = yield* Effect.result(
					fillDefaultLineQueueFx({
						ownerItemId,
					}),
				);
				return {
					after: yield* (yield* CommittedTransitionsFx).read,
					attempt,
					before,
				};
			}).pipe(
				useGameFx({
					config: createDefaultLineConfig(5),
				}),
			),
		);

		expect(Result.isFailure(result.attempt)).toBe(true);
		if (Result.isFailure(result.attempt)) {
			expect(result.attempt.failure).toMatchObject({
				_tag: "DefaultLineQueueUnavailableError",
				ownerItemId,
			});
		}
		expect(result.after).toBe(result.before);
		expect(result.after.runtime.jobQueue).toEqual([]);
	});
});
