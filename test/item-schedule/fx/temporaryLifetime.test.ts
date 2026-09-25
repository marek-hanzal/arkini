import { Effect, Random } from "effect";
import { describe, expect, it } from "vitest";

import { useGameFx } from "~test/support/useGameFx";
import { startLineFx } from "~test/production-job/support/startLineTestFx";
import { mergeItemsFx } from "~/item-merge/fx/mergeItemsFx";
import { checkRuntimeFx } from "~/game-runtime/fx/checkRuntimeFx";
import { fromStateFx } from "~/game-persistence/fx/fromStateFx";
import { readRuntimeFx } from "~/game-runtime/fx/readRuntimeFx";
import { dropItemFx } from "~/item-interaction/fx/dropItemFx";
import { removeRuntimeItemForTestFx } from "~test/item-interaction/support/removeRuntimeItemForTestFx";
import { spawnItemFx } from "~test/support/spawnItemFx";
import type { RuntimeSchema } from "~/game-runtime/schema/RuntimeSchema";
import { fromRuntimeFn } from "~/game-persistence/fn/fromRuntimeFn";
import { runTickRuntimeByFx } from "~test/game-tick/support/runTickRuntimeByFx";
import { advanceRuntimeStepFx } from "~/game-tick/fx/advanceRuntimeStepFx";
import { projectCommittedEngineFactsFx } from "~/game-event/fx/projectCommittedEngineFactsFx";
import { createTemporaryLifetimeTestConfig } from "~test/item-schedule/fx/temporaryLifetime.test/createTemporaryLifetimeTestConfig";
import { GameEventEnumSchema } from "~/game-event/schema/GameEventEnumSchema";
import { CommittedTransitionsFx } from "~/game-runtime/context/CommittedTransitionsFx";
import { RuntimeCheckIssueEnumSchema } from "~/game-runtime/schema/RuntimeCheckIssueEnumSchema";

const config = createTemporaryLifetimeTestConfig();

const summarizeRuntime = (runtime: RuntimeSchema.Type) => ({
	cheats: {
		enabled: false,
		everEnabled: false,
		speedUpGameplay: false,
	},
	currentSpace: 0,
	templateUidBySpace: {},
	items: runtime.items
		.map((item) => ({
			id: item.id,
			itemId: item.item.uid,
			location: item.location,

			remainingDurationMs: item.schedule?.remainingDurationMs,
		}))
		.sort((first, second) => first.id.localeCompare(second.id)),
	jobs: runtime.jobs,
	jobQueue: runtime.jobQueue ?? [],
});

const spawnTemporaryFx = Effect.fn("spawnTemporaryFx")(function* ({
	id = "runtime:temporary",
	itemId = "temporaryPlain",
	x = 0,
}: {
	id?: string;
	itemId?: string;
	x?: number;
}) {
	return yield* spawnItemFx({
		id,
		itemUid: itemId,
		location: {
			scope: "board",
			space: 0,
			position: {
				x,
				y: 0,
			},
		},
	});
});

const spawnBlockerFx = Effect.fn("spawnBlockerFx")(function* (id: string, x: number) {
	return yield* spawnItemFx({
		id,
		itemUid: "blocker",
		location: {
			scope: "board",
			space: 0,
			position: {
				x,
				y: 0,
			},
		},
	});
});

describe("temporary item lifetime", () => {
	it("starts at authored duration and expires exactly on its fixed-step boundary", () => {
		const result = Effect.runSync(
			Effect.gen(function* () {
				const spawned = yield* spawnTemporaryFx({});
				const initial = yield* readRuntimeFx();
				const first = yield* advanceRuntimeStepFx(initial);
				const second = yield* advanceRuntimeStepFx(first.runtime);
				const third = yield* advanceRuntimeStepFx(second.runtime);
				const fourth = yield* advanceRuntimeStepFx(third.runtime);
				const fifth = yield* advanceRuntimeStepFx(fourth.runtime);
				const sixth = yield* advanceRuntimeStepFx(fifth.runtime);
				return {
					spawned,
					first,
					second,
					third,
					fourth,
					fifth,
					sixth,
					sixthEvents: yield* projectCommittedEngineFactsFx({
						previousRuntime: fifth.runtime,
						runtime: sixth.runtime,
						facts: sixth.facts,
					}),
				};
			}).pipe(
				useGameFx({
					config,
				}),
			),
		);

		expect(result.spawned.schedule?.remainingDurationMs).toBe(600);
		expect(result.first.runtime.items[0]?.schedule?.remainingDurationMs).toBe(500);
		expect(result.first.runtime.items[0]?.revision).toBe(result.spawned.revision);
		expect(result.second.runtime.items[0]?.schedule?.remainingDurationMs).toBe(400);
		expect(result.third.runtime.items[0]?.schedule?.remainingDurationMs).toBe(300);
		expect(result.fourth.runtime.items[0]?.schedule?.remainingDurationMs).toBe(200);
		expect(result.fifth.runtime.items[0]?.schedule?.remainingDurationMs).toBe(100);
		expect(result.sixth.runtime.items).toEqual([]);
		expect(result.sixthEvents).toEqual([
			{
				type: GameEventEnumSchema.enum.ItemRemoved,
				snapshot: {
					...result.spawned,
					schedule: {
						...result.spawned.schedule,
						remainingDurationMs: 0,
						pulseSequence: undefined,
					},
				},
			},
			{
				type: GameEventEnumSchema.enum.ItemExpired,
				itemId: "runtime:temporary",
				itemUid: "temporaryPlain",
				location: {
					scope: "board",
					space: 0,
					position: {
						x: 0,
						y: 0,
					},
				},
			},
			{
				type: GameEventEnumSchema.enum.ItemDisappeared,
				itemId: "runtime:temporary",
				itemUid: "temporaryPlain",
				location: {
					scope: "board",
					space: 0,
					position: {
						x: 0,
						y: 0,
					},
				},
			},
		]);
	});

	it("reports disappearance when configured expiry outcome resolves to nothing", () => {
		const result = Effect.runSync(
			Effect.gen(function* () {
				const temporary = yield* spawnTemporaryFx({
					itemId: "temporaryEmptyOutput",
				});
				yield* runTickRuntimeByFx({
					elapsedMs: 700,
				});
				return {
					runtime: yield* readRuntimeFx(),
					temporary,
					transition: yield* (yield* CommittedTransitionsFx).read,
				};
			}).pipe(
				useGameFx({
					config,
				}),
			),
		);

		expect(result.runtime.items.some((item) => item.id === result.temporary.id)).toBe(false);
		expect(result.transition.events.map((event) => event.type)).toEqual([
			GameEventEnumSchema.enum.JobQueued,
			GameEventEnumSchema.enum.JobStarted,
			GameEventEnumSchema.enum.JobCompleted,
			GameEventEnumSchema.enum.ItemRemoved,
			GameEventEnumSchema.enum.ItemExpired,
			GameEventEnumSchema.enum.ItemDisappeared,
		]);
	});

	it("replays one long elapsed budget equivalently to individual fixed steps", () => {
		const run = (elapsed: readonly number[]) =>
			Effect.runSync(
				Effect.gen(function* () {
					yield* spawnTemporaryFx({});
					for (const elapsedMs of elapsed) {
						yield* runTickRuntimeByFx({
							elapsedMs,
						});
					}
					return summarizeRuntime(yield* readRuntimeFx());
				}).pipe(
					useGameFx({
						config,
					}),
				),
			);

		expect(
			run([
				400,
			]),
		).toEqual(
			run([
				200,
				200,
			]),
		);
	});

	it("keeps a temporary item draggable across passive lifetime ticks", () => {
		const result = Effect.runSync(
			Effect.gen(function* () {
				const spawned = yield* spawnTemporaryFx({});
				yield* runTickRuntimeByFx({
					elapsedMs: 100,
				});
				const outcome = yield* dropItemFx({
					sourceItemId: spawned.id,
					sourceLocation: spawned.location,
					sourceRevision: spawned.revision,
					target: {
						kind: "slot",
						location: {
							scope: "board",
							space: 0,
							position: {
								x: 1,
								y: 0,
							},
						},
						occupant: null,
					},
				});
				return {
					outcome,
					runtime: yield* readRuntimeFx(),
				};
			}).pipe(
				useGameFx({
					config,
				}),
			),
		);

		expect(result.outcome).toMatchObject({
			kind: "move",
			location: {
				scope: "board",
				space: 0,
				position: {
					x: 1,
					y: 0,
				},
			},
		});
		expect(result.runtime.items[0]?.schedule?.remainingDurationMs).toBe(500);
	});

	it("persists and restores the remaining duration with a fresh revision", () => {
		const result = Effect.runSync(
			Effect.gen(function* () {
				const spawned = yield* spawnTemporaryFx({});
				yield* runTickRuntimeByFx({
					elapsedMs: 200,
				});
				const runtime = yield* readRuntimeFx();
				const state = fromRuntimeFn({
					runtime,
				});
				const restored = yield* fromStateFx({
					state,
				});
				return {
					restored: restored.items[0],
					spawned,
					state: state.items[0],
				};
			}).pipe(
				useGameFx({
					config,
				}),
			),
		);

		expect(result.state?.schedule?.remainingDurationMs).toBe(400);
		expect(result.restored?.schedule?.remainingDurationMs).toBe(400);
		expect(result.restored?.revision).not.toBe(result.spawned.revision);
	});

	it("publishes expiry and ordinary same-anchor spawn as separate exact facts", () => {
		const result = Effect.runSync(
			Effect.gen(function* () {
				const temporary = yield* spawnTemporaryFx({
					itemId: "temporaryOutput",
					x: 2,
				});
				const initial = yield* readRuntimeFx();
				const first = yield* advanceRuntimeStepFx(initial);
				const second = yield* advanceRuntimeStepFx(first.runtime);
				const third = yield* advanceRuntimeStepFx(second.runtime);
				const fourth = yield* advanceRuntimeStepFx(third.runtime);
				const fifth = yield* advanceRuntimeStepFx(fourth.runtime);
				const sixth = yield* advanceRuntimeStepFx(fifth.runtime);
				const seventh = yield* advanceRuntimeStepFx(sixth.runtime);
				const outcome = seventh.runtime.items.find((item) => item.item.uid === "result");
				if (outcome === undefined) throw new Error("Expected expiry outcome.");
				return {
					outcome,
					temporary,
					expiry: seventh,
					expiryEvents: yield* projectCommittedEngineFactsFx({
						previousRuntime: sixth.runtime,
						runtime: seventh.runtime,
						facts: seventh.facts,
					}),
				};
			}).pipe(
				useGameFx({
					config,
				}),
			),
		);

		expect(result.expiryEvents).toEqual([
			expect.objectContaining({
				type: GameEventEnumSchema.enum.JobCompleted,
				ownerItemId: result.temporary.id,
				lineUid: "expiry:temporaryOutput",
			}),
			{
				type: GameEventEnumSchema.enum.ItemRemoved,
				snapshot: {
					...result.temporary,
					schedule: {
						...result.temporary.schedule,
						remainingDurationMs: 0,
						pulseSequence: undefined,
					},
				},
			},
			{
				type: GameEventEnumSchema.enum.ItemExpired,
				itemId: result.temporary.id,
				itemUid: "temporaryOutput",
				location: result.temporary.location,
			},
			{
				type: GameEventEnumSchema.enum.ItemSpawned,
				itemId: result.outcome.id,
				itemUid: "result",
				originItemId: result.temporary.id,
				location: result.outcome.location,
			},
		]);
		expect(
			result.expiryEvents.some(
				(event) => event.type === GameEventEnumSchema.enum.ItemDisappeared,
			),
		).toBe(false);
		expect(result.outcome.location).toEqual(result.temporary.location);
		expect(result.outcome.id).not.toBe(result.temporary.id);
	});

	it("atomically removes the temporary item and places its expiry outcome from the released origin", () => {
		const runtime = Effect.runSync(
			Effect.gen(function* () {
				yield* spawnTemporaryFx({
					itemId: "temporaryOutput",
					x: 2,
				});
				yield* runTickRuntimeByFx({
					elapsedMs: 700,
				});
				return yield* readRuntimeFx();
			}).pipe(
				useGameFx({
					config,
				}),
			),
		);

		expect(runtime.items).toEqual([
			expect.objectContaining({
				item: expect.objectContaining({
					uid: "result",
				}),
				location: {
					scope: "board",
					space: 0,
					position: {
						x: 2,
						y: 0,
					},
				},
			}),
		]);
	});

	it("keeps a blocked expiry at zero and preserves the deterministic random result across retry", () => {
		const result = Effect.runSync(
			Effect.gen(function* () {
				yield* spawnTemporaryFx({
					id: "runtime:random-temporary",
					itemId: "temporaryRandomOutput",
				});
				const blockers = [];
				for (const [index, x] of [
					1,
					2,
					3,
				].entries())
					blockers.push(yield* spawnBlockerFx(`runtime:blocker:${index}`, x));
				yield* runTickRuntimeByFx({
					elapsedMs: 700,
				});
				const blocked = yield* readRuntimeFx();
				for (const blocker of blockers.slice(1))
					yield* removeRuntimeItemForTestFx({
						itemId: blocker.id,
						revision: blocker.revision,
					});
				const free = yield* readRuntimeFx();
				const first = yield* advanceRuntimeStepFx(free).pipe(Random.withSeed("first"));
				const second = yield* advanceRuntimeStepFx(free).pipe(Random.withSeed("second"));
				return {
					blocked,
					first,
					second,
				};
			}).pipe(
				useGameFx({
					config,
				}),
			),
		);
		expect(result.blocked.items).toContainEqual(
			expect.objectContaining({
				id: "runtime:random-temporary",
				schedule: {
					remainingDurationMs: 0,
				},
			}),
		);
		const summarizeResults = (runtime: RuntimeSchema.Type) =>
			runtime.items
				.filter((item) => item.item.uid === "result")
				.map((item) => ({
					location: item.location,
				}))
				.sort((first, second) =>
					JSON.stringify(first.location).localeCompare(JSON.stringify(second.location)),
				);
		expect(summarizeResults(result.first.runtime)).toEqual(
			summarizeResults(result.second.runtime),
		);
		expect(
			result.first.runtime.items.some((item) => item.id === "runtime:random-temporary"),
		).toBe(false);
	});

	it("expires simultaneous lifetime jobs after ordinary completion", () => {
		const transition = Effect.runSync(
			Effect.gen(function* () {
				yield* spawnTemporaryFx({
					id: "runtime:b",
					itemId: "temporaryCappedOutput",
					x: 1,
				});
				yield* spawnTemporaryFx({
					id: "runtime:a",
					itemId: "temporaryCappedOutput",
					x: 0,
				});
				yield* runTickRuntimeByFx({
					elapsedMs: 700,
				});
				return yield* (yield* CommittedTransitionsFx).read;
			}).pipe(
				useGameFx({
					config,
				}),
			),
		);

		expect(
			transition.events
				.filter((event) => event.type === GameEventEnumSchema.enum.ItemExpired)
				.map((event) => event.itemId),
		).toHaveLength(2);
		expect(
			new Set(
				transition.events
					.filter((event) => event.type === GameEventEnumSchema.enum.ItemExpired)
					.map((event) => event.itemId),
			),
		).toEqual(
			new Set([
				"runtime:a",
				"runtime:b",
			]),
		);
		expect(
			transition.runtime.items.filter((item) => item.item.uid === "cappedResult"),
		).toHaveLength(2);
	});

	it("does not retroactively age a temporary item created during the current step", () => {
		const runtime = Effect.runSync(
			Effect.gen(function* () {
				const producer = yield* spawnItemFx({
					id: "runtime:producer",
					itemUid: "producer",
					location: {
						scope: "board",
						space: 0,
						position: {
							x: 0,
							y: 0,
						},
					},
				});
				yield* startLineFx({
					ownerItemId: producer.id,
					lineUid: "line:producer:temporary",
				});
				yield* runTickRuntimeByFx({
					elapsedMs: 200,
				});
				return yield* readRuntimeFx();
			}).pipe(
				useGameFx({
					config,
				}),
			),
		);

		expect(runtime.items).toContainEqual(
			expect.objectContaining({
				item: expect.objectContaining({
					uid: "temporaryPlain",
				}),
				schedule: {
					remainingDurationMs: 600,
				},
			}),
		);
	});

	it("initializes the full duration when merge replacement creates a temporary identity", () => {
		const result = Effect.runSync(
			Effect.gen(function* () {
				const source = yield* spawnItemFx({
					id: "runtime:transformer",
					itemUid: "transformer",
					location: {
						scope: "board",
						space: 0,
						position: {
							x: 0,
							y: 0,
						},
					},
				});
				const target = yield* spawnBlockerFx("runtime:target", 1);
				yield* mergeItemsFx({
					sourceItemId: source.id,
					sourceRevision: source.revision,
					targetItemId: target.id,
					targetRevision: target.revision,
				});
				return {
					runtime: yield* readRuntimeFx(),
					target,
				};
			}).pipe(
				useGameFx({
					config,
				}),
			),
		);

		const replaced = result.runtime.items.find((item) => item.id === "runtime:target");
		expect(replaced).toMatchObject({
			id: "runtime:target",
			item: {
				uid: "temporaryPlain",
			},
			location: result.target.location,
			schedule: {
				remainingDurationMs: 600,
			},
		});
		expect(replaced?.revision).not.toBe(result.target.revision);
	});

	it("reports temporary duration state attached to a non-temporary item", () => {
		const result = Effect.runSync(
			Effect.gen(function* () {
				const blocker = yield* spawnBlockerFx("runtime:blocker", 0);
				const runtime = yield* readRuntimeFx();
				return yield* checkRuntimeFx({
					runtime: {
						...runtime,
						items: runtime.items.map((item) =>
							item.id === blocker.id
								? {
										...item,
										schedule: {
											remainingDurationMs: 400,
										},
									}
								: item,
						),
					},
				});
			}).pipe(
				useGameFx({
					config,
				}),
			),
		);

		expect(result.issues).toEqual([
			{
				type: RuntimeCheckIssueEnumSchema.enum.ItemSchedule,
				itemId: "runtime:blocker",
				reason: "unexpected-state",
			},
		]);
	});
});
