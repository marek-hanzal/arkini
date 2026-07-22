import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { useGameFx } from "~/engine/game/fx/useGameFx";
import { startLineFx } from "~/engine/job/write/startLineFx";
import { mergeItemsFx } from "~/engine/merge/write/mergeItemsFx";
import { checkRuntimeFx } from "~/engine/runtime/check/checkRuntimeFx";
import { fromStateFx } from "~/engine/runtime/fx/fromStateFx";
import { readRuntimeFx } from "~/engine/runtime/read/readRuntimeFx";
import { removeItemFx } from "~/engine/runtime/write/removeItemFx";
import { spawnItemFx } from "~/engine/runtime/write/spawnItemFx";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";
import { fromRuntimeFx } from "~/engine/state/fx/fromRuntimeFx";
import { runTickRuntimeByFx } from "~/engine/tick/fx/runTickRuntimeByFx";
import { advanceRuntimeStepFx } from "~/engine/tick/internal/advanceRuntimeStepFx";
import { createTemporaryLifetimeTestConfig } from "~test/item/temporary/support/createTemporaryLifetimeTestConfig";
import { GameEventEnumSchema } from "~/engine/event/schema/GameEventEnumSchema";
import { RuntimeCheckIssueEnumSchema } from "~/engine/runtime/schema/check/RuntimeCheckIssueEnumSchema";
import { ItemTemporaryDurationIssueReasonEnumSchema } from "~/engine/runtime/schema/check/ItemTemporaryDurationIssueReasonEnumSchema";
import { ItemRemovedReasonEnumSchema } from "~/engine/event/schema/ItemRemovedReasonEnumSchema";

const config = createTemporaryLifetimeTestConfig();

const summarizeRuntime = (runtime: RuntimeSchema.Type) => ({
	cheats: {
		enabled: false,
		everEnabled: false,
		instantGameplay: false,
	},
	currentSpace: 0,
	items: runtime.items
		.map((item) => ({
			id: item.id,
			itemId: item.item.id,
			location: item.location,
			quantity: item.quantity,
			remainingDurationMs: item.remainingDurationMs,
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
		itemId,
		location: {
			scope: "board",
			space: 0,
			position: {
				x,
				y: 0,
			},
		},
		quantity: 1,
	});
});

const spawnBlockerFx = Effect.fn("spawnBlockerFx")(function* (id: string, x: number) {
	return yield* spawnItemFx({
		id,
		itemId: "blocker",
		location: {
			scope: "board",
			space: 0,
			position: {
				x,
				y: 0,
			},
		},
		quantity: 1,
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
				return {
					spawned,
					first,
					second,
					third,
				};
			}).pipe(
				useGameFx({
					config,
				}),
			),
		);

		expect(result.spawned.remainingDurationMs).toBe(600);
		expect(result.first.runtime.items[0]?.remainingDurationMs).toBe(400);
		expect(result.second.runtime.items[0]?.remainingDurationMs).toBe(200);
		expect(result.third.runtime.items).toEqual([]);
		expect(result.third.events).toEqual([
			{
				type: GameEventEnumSchema.enum.ItemExpired,
				itemId: "runtime:temporary",
				canonicalItemId: "temporaryPlain",
				location: {
					scope: "board",
					space: 0,
					position: {
						x: 0,
						y: 0,
					},
				},
				quantity: 1,
			},
			{
				type: GameEventEnumSchema.enum.ItemRemoved,
				itemId: "runtime:temporary",
				canonicalItemId: "temporaryPlain",
				location: {
					scope: "board",
					space: 0,
					position: {
						x: 0,
						y: 0,
					},
				},
				quantity: 1,
				reason: ItemRemovedReasonEnumSchema.enum.Expired,
			},
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

	it("persists and restores the remaining duration with a fresh revision", () => {
		const result = Effect.runSync(
			Effect.gen(function* () {
				const spawned = yield* spawnTemporaryFx({});
				yield* runTickRuntimeByFx({
					elapsedMs: 200,
				});
				const runtime = yield* readRuntimeFx();
				const state = yield* fromRuntimeFx({
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

		expect(result.state?.remainingDurationMs).toBe(400);
		expect(result.restored?.remainingDurationMs).toBe(400);
		expect(result.restored?.revision).not.toBe(result.spawned.revision);
	});

	it("atomically removes the temporary item and places its expiry output from the released origin", () => {
		const runtime = Effect.runSync(
			Effect.gen(function* () {
				yield* spawnTemporaryFx({
					itemId: "temporaryOutput",
					x: 2,
				});
				yield* runTickRuntimeByFx({
					elapsedMs: 600,
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
					id: "result",
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
		const run = (blocked: boolean) =>
			Effect.runSync(
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
					].entries()) {
						if (!blocked && index > 0) continue;
						blockers.push(yield* spawnBlockerFx(`runtime:blocker:${index}`, x));
					}
					yield* runTickRuntimeByFx({
						elapsedMs: 600,
					});
					const first = yield* readRuntimeFx();
					if (blocked) {
						for (const blocker of blockers.slice(1)) {
							yield* removeItemFx({
								itemId: blocker.id,
								revision: blocker.revision,
							});
						}
						yield* runTickRuntimeByFx({
							elapsedMs: 200,
						});
					}
					return {
						first,
						final: yield* readRuntimeFx(),
					};
				}).pipe(
					useGameFx({
						config,
					}),
				),
			);

		const blocked = run(true);
		const direct = run(false);
		expect(blocked.first.items).toContainEqual(
			expect.objectContaining({
				id: "runtime:random-temporary",
				remainingDurationMs: 0,
			}),
		);
		const summarizeResults = (runtime: RuntimeSchema.Type) =>
			runtime.items
				.filter((item) => item.item.id === "result")
				.map((item) => ({
					location: item.location,
					quantity: item.quantity,
				}))
				.sort((first, second) =>
					JSON.stringify(first.location).localeCompare(JSON.stringify(second.location)),
				);
		expect(summarizeResults(blocked.final)).toEqual(summarizeResults(direct.final));
		expect(blocked.final.items.some((item) => item.id === "runtime:random-temporary")).toBe(
			false,
		);
	});

	it("expires simultaneous items in stable runtime-ID order", () => {
		const runtime = Effect.runSync(
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
					elapsedMs: 600,
				});
				return yield* readRuntimeFx();
			}).pipe(
				useGameFx({
					config,
				}),
			),
		);

		expect(runtime.items.some((item) => item.id === "runtime:a")).toBe(false);
		expect(runtime.items).toContainEqual(
			expect.objectContaining({
				id: "runtime:b",
				remainingDurationMs: 0,
			}),
		);
		expect(runtime.items.filter((item) => item.item.id === "cappedResult")).toHaveLength(1);
	});

	it("does not retroactively age a temporary item created during the current step", () => {
		const runtime = Effect.runSync(
			Effect.gen(function* () {
				const producer = yield* spawnItemFx({
					id: "runtime:producer",
					itemId: "producer",
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
				yield* startLineFx({
					ownerItemId: producer.id,
					lineId: "line:producer:temporary",
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
					id: "temporaryPlain",
				}),
				remainingDurationMs: 600,
			}),
		);
	});

	it("initializes the full duration when merge replacement creates a temporary identity", () => {
		const result = Effect.runSync(
			Effect.gen(function* () {
				const source = yield* spawnItemFx({
					id: "runtime:transformer",
					itemId: "transformer",
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
				id: "temporaryPlain",
			},
			location: result.target.location,
			remainingDurationMs: 600,
		});
		expect(replaced?.revision).not.toBe(result.target.revision);
	});

	it("reports temporary items outside the board", () => {
		const result = Effect.runSync(
			Effect.gen(function* () {
				const temporary = yield* spawnTemporaryFx({});
				const runtime = yield* readRuntimeFx();
				return yield* checkRuntimeFx({
					runtime: {
						...runtime,
						items: runtime.items.map((item) =>
							item.id === temporary.id
								? {
										...item,
										location: {
											scope: "inventory",
											position: {
												x: 0,
												y: 0,
											},
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

		expect(result.issues).toEqual(
			expect.arrayContaining([
				{
					type: RuntimeCheckIssueEnumSchema.enum.ItemTemporaryDuration,
					itemId: "runtime:temporary",
					durationMs: 600,
					remainingDurationMs: 600,
					location: {
						scope: "inventory",
						position: {
							x: 0,
							y: 0,
						},
					},
					reason: ItemTemporaryDurationIssueReasonEnumSchema.enum.NotBoard,
				},
			]),
		);
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
										remainingDurationMs: 400,
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
				type: RuntimeCheckIssueEnumSchema.enum.ItemTemporaryDuration,
				itemId: "runtime:blocker",
				remainingDurationMs: 400,
				location: {
					scope: "board",
					space: 0,
					position: {
						x: 0,
						y: 0,
					},
				},
				reason: ItemTemporaryDurationIssueReasonEnumSchema.enum.UnexpectedState,
			},
		]);
	});
});
