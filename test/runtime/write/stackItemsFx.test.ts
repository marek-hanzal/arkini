import { Effect, Either } from "effect";
import { describe, expect, it } from "vitest";

import { useGameFx } from "~/engine/game/fx/useGameFx";
import { setDefaultLineFx } from "~/engine/line/write/setDefaultLineFx";
import { readItemStackResolutionFx } from "~/engine/runtime/read/readItemStackResolutionFx";
import { readRuntimeFx } from "~/engine/runtime/read/readRuntimeFx";
import { stackItemsFx } from "~/engine/runtime/write/stackItemsFx";
import { spawnItemFx } from "~/engine/runtime/write/spawnItemFx";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";
import { purityTestConfig } from "~test/line/support/purityTestConfig";

const board = (x: number, space = 0) => ({
	scope: "board" as const,
	space,
	position: {
		x,
		y: 0,
	},
});

const inventory = (x: number) => ({
	scope: "inventory" as const,
	position: {
		x,
		y: 0,
	},
});

describe("stackItemsFx", () => {
	it("partially fills the target while preserving exact source and target identities", () => {
		const result = Effect.runSync(
			Effect.gen(function* () {
				const source = yield* spawnItemFx({
					id: "runtime:source",
					itemId: "material",
					location: board(0),
					quantity: 5,
				});
				const target = yield* spawnItemFx({
					id: "runtime:target",
					itemId: "material",
					location: inventory(0),
					quantity: 8,
				});
				const stacked = yield* stackItemsFx({
					sourceItemId: source.id,
					sourceRevision: source.revision,
					sourceLocation: source.location,
					targetItemId: target.id,
					targetRevision: target.revision,
					targetLocation: target.location,
				});

				return {
					runtime: yield* readRuntimeFx(),
					source,
					stacked,
					target,
				};
			}).pipe(
				useGameFx({
					config: purityTestConfig,
				}),
			),
		);

		expect(result.stacked).toMatchObject({
			sourceBefore: result.source,
			targetBefore: result.target,
			transferredQuantity: 2,
			sourceAfter: {
				id: result.source.id,
				item: {
					id: "material",
				},
				location: result.source.location,
				quantity: 3,
			},
			targetAfter: {
				id: result.target.id,
				item: {
					id: "material",
				},
				location: result.target.location,
				quantity: 10,
			},
		});
		expect(result.stacked.sourceAfter?.revision).not.toBe(result.source.revision);
		expect(result.stacked.targetAfter.revision).not.toBe(result.target.revision);
		expect(result.runtime.items).toEqual([
			result.stacked.sourceAfter,
			result.stacked.targetAfter,
		]);
		expect(result.runtime.items.reduce((total, item) => total + item.quantity, 0)).toBe(13);
	});

	it("removes a fully transferred source and revises only the surviving target identity", () => {
		const result = Effect.runSync(
			Effect.gen(function* () {
				const source = yield* spawnItemFx({
					id: "runtime:source",
					itemId: "material",
					location: board(0),
					quantity: 2,
				});
				const target = yield* spawnItemFx({
					id: "runtime:target",
					itemId: "material",
					location: board(1),
					quantity: 5,
				});
				const stacked = yield* stackItemsFx({
					sourceItemId: source.id,
					sourceRevision: source.revision,
					sourceLocation: source.location,
					targetItemId: target.id,
					targetRevision: target.revision,
					targetLocation: target.location,
				});

				return {
					runtime: yield* readRuntimeFx(),
					source,
					stacked,
					target,
				};
			}).pipe(
				useGameFx({
					config: purityTestConfig,
				}),
			),
		);

		expect(result.stacked.sourceBefore).toBe(result.source);
		expect(result.stacked.sourceAfter).toBeUndefined();
		expect(result.stacked.targetBefore).toBe(result.target);
		expect(result.stacked.targetAfter).toMatchObject({
			id: result.target.id,
			location: result.target.location,
			quantity: 7,
		});
		expect(result.stacked.targetAfter.revision).not.toBe(result.target.revision);
		expect(result.runtime.items).toEqual([
			result.stacked.targetAfter,
		]);
	});

	it("rejects a full target without swapping identical stacks or committing anything", () => {
		const result = Effect.runSync(
			Effect.gen(function* () {
				const source = yield* spawnItemFx({
					id: "runtime:source",
					itemId: "material",
					location: board(0),
					quantity: 2,
				});
				const target = yield* spawnItemFx({
					id: "runtime:target",
					itemId: "material",
					location: board(1),
					quantity: 10,
				});
				const before = yield* readRuntimeFx();
				const stacked = yield* Effect.either(
					stackItemsFx({
						sourceItemId: source.id,
						sourceRevision: source.revision,
						sourceLocation: source.location,
						targetItemId: target.id,
						targetRevision: target.revision,
						targetLocation: target.location,
					}),
				);

				return {
					after: yield* readRuntimeFx(),
					before,
					stacked,
				};
			}).pipe(
				useGameFx({
					config: purityTestConfig,
				}),
			),
		);

		expect(Either.isLeft(result.stacked)).toBe(true);
		if (Either.isLeft(result.stacked)) {
			expect(result.stacked.left).toMatchObject({
				_tag: "StackItemsUnavailableError",
				reason: "target-full",
				sourceItemId: "runtime:source",
				targetItemId: "runtime:target",
			});
		}
		expect(result.after).toBe(result.before);
	});

	it.each([
		{
			stateful: "source" as const,
			reason: "source-stateful",
		},
		{
			stateful: "target" as const,
			reason: "target-stateful",
		},
	])("rejects a $stateful identity and preserves the complete runtime", ({
		stateful,
		reason,
	}) => {
		const result = Effect.runSync(
			Effect.gen(function* () {
				const source = yield* spawnItemFx({
					id: "runtime:source",
					itemId: "producer",
					location: board(0),
					quantity: 1,
				});
				const target = yield* spawnItemFx({
					id: "runtime:target",
					itemId: "producer",
					location: board(1),
					quantity: 1,
				});
				yield* setDefaultLineFx({
					ownerItemId: stateful === "source" ? source.id : target.id,
					lineId: "line:producer:zero",
				});
				const before = yield* readRuntimeFx();
				const stacked = yield* Effect.either(
					stackItemsFx({
						sourceItemId: source.id,
						sourceRevision: source.revision,
						sourceLocation: source.location,
						targetItemId: target.id,
						targetRevision: target.revision,
						targetLocation: target.location,
					}),
				);

				return {
					after: yield* readRuntimeFx(),
					before,
					stacked,
				};
			}).pipe(
				useGameFx({
					config: purityTestConfig,
				}),
			),
		);

		expect(Either.isLeft(result.stacked)).toBe(true);
		if (Either.isLeft(result.stacked)) {
			expect(result.stacked.left).toMatchObject({
				_tag: "StackItemsUnavailableError",
				reason,
			});
		}
		expect(result.after).toBe(result.before);
	});

	it("rejects stale revisions and exact-location mismatches without a partial commit", () => {
		const result = Effect.runSync(
			Effect.gen(function* () {
				const source = yield* spawnItemFx({
					id: "runtime:source",
					itemId: "material",
					location: board(0),
					quantity: 5,
				});
				const target = yield* spawnItemFx({
					id: "runtime:target",
					itemId: "material",
					location: board(1),
					quantity: 5,
				});
				const staleRevision = yield* Effect.either(
					stackItemsFx({
						sourceItemId: source.id,
						sourceRevision: "revision:stale",
						sourceLocation: source.location,
						targetItemId: target.id,
						targetRevision: target.revision,
						targetLocation: target.location,
					}),
				);
				const beforeLocationMismatch = yield* readRuntimeFx();
				const staleLocation = yield* Effect.either(
					stackItemsFx({
						sourceItemId: source.id,
						sourceRevision: source.revision,
						sourceLocation: source.location,
						targetItemId: target.id,
						targetRevision: target.revision,
						targetLocation: board(3),
					}),
				);

				return {
					after: yield* readRuntimeFx(),
					beforeLocationMismatch,
					staleLocation,
					staleRevision,
				};
			}).pipe(
				useGameFx({
					config: purityTestConfig,
				}),
			),
		);

		expect(Either.isLeft(result.staleRevision)).toBe(true);
		if (Either.isLeft(result.staleRevision)) {
			expect(result.staleRevision.left).toMatchObject({
				_tag: "StackItemsUnavailableError",
				reason: "stale-source-revision",
			});
		}
		expect(Either.isLeft(result.staleLocation)).toBe(true);
		if (Either.isLeft(result.staleLocation)) {
			expect(result.staleLocation.left).toMatchObject({
				_tag: "StackItemsUnavailableError",
				reason: "stale-target-location",
			});
		}
		expect(result.after).toBe(result.beforeLocationMismatch);
	});

	it("rejects direct stacking across isolated board spaces", () => {
		const result = Effect.runSync(
			Effect.gen(function* () {
				const source = yield* spawnItemFx({
					id: "runtime:source",
					itemId: "material",
					location: board(0, 1),
					quantity: 2,
				});
				const target = yield* spawnItemFx({
					id: "runtime:target",
					itemId: "material",
					location: board(1, 0),
					quantity: 5,
				});
				const before = yield* readRuntimeFx();
				const stacked = yield* Effect.either(
					stackItemsFx({
						sourceItemId: source.id,
						sourceRevision: source.revision,
						sourceLocation: source.location,
						targetItemId: target.id,
						targetRevision: target.revision,
						targetLocation: target.location,
					}),
				);

				return {
					after: yield* readRuntimeFx(),
					before,
					stacked,
				};
			}).pipe(
				useGameFx({
					config: purityTestConfig,
				}),
			),
		);

		expect(Either.isLeft(result.stacked)).toBe(true);
		if (Either.isLeft(result.stacked)) {
			expect(result.stacked.left).toMatchObject({
				_tag: "StackItemsUnavailableError",
				reason: "cross-space",
			});
		}
		expect(result.after).toBe(result.before);
	});

	it("serializes competing transfers so one stale target cannot overflow or lose quantity", async () => {
		const result = await Effect.runPromise(
			Effect.gen(function* () {
				const firstSource = yield* spawnItemFx({
					id: "runtime:first-source",
					itemId: "material",
					location: board(0),
					quantity: 2,
				});
				const secondSource = yield* spawnItemFx({
					id: "runtime:second-source",
					itemId: "material",
					location: board(1),
					quantity: 2,
				});
				const target = yield* spawnItemFx({
					id: "runtime:target",
					itemId: "material",
					location: board(2),
					quantity: 7,
				});
				const attempts = yield* Effect.all(
					[
						Effect.either(
							stackItemsFx({
								sourceItemId: firstSource.id,
								sourceRevision: firstSource.revision,
								sourceLocation: firstSource.location,
								targetItemId: target.id,
								targetRevision: target.revision,
								targetLocation: target.location,
							}),
						),
						Effect.either(
							stackItemsFx({
								sourceItemId: secondSource.id,
								sourceRevision: secondSource.revision,
								sourceLocation: secondSource.location,
								targetItemId: target.id,
								targetRevision: target.revision,
								targetLocation: target.location,
							}),
						),
					],
					{
						concurrency: "unbounded",
					},
				);

				return {
					attempts,
					runtime: yield* readRuntimeFx(),
				};
			}).pipe(
				useGameFx({
					config: purityTestConfig,
				}),
			),
		);

		expect(result.attempts.filter(Either.isRight)).toHaveLength(1);
		expect(result.attempts.filter(Either.isLeft)).toHaveLength(1);
		const failure = result.attempts.find(Either.isLeft);
		expect(failure?.left).toMatchObject({
			_tag: "StackItemsUnavailableError",
			reason: "stale-target-revision",
		});
		expect(result.runtime.items.find((item) => item.id === "runtime:target")).toMatchObject({
			quantity: 9,
		});
		expect(result.runtime.items.reduce((total, item) => total + item.quantity, 0)).toBe(11);
	});
});

describe("readItemStackResolutionFx", () => {
	it("distinguishes unrelated items, missing grid ownership, and exact optimistic facts", () => {
		const result = Effect.runSync(
			Effect.gen(function* () {
				const source = yield* spawnItemFx({
					id: "runtime:source",
					itemId: "material",
					location: board(0),
					quantity: 2,
				});
				const target = yield* spawnItemFx({
					id: "runtime:target",
					itemId: "producer",
					location: board(1),
					quantity: 1,
				});
				const runtime = yield* readRuntimeFx();
				const base = {
					runtime,
					sourceItemId: source.id,
					sourceRevision: source.revision,
					sourceLocation: source.location,
					targetItemId: target.id,
					targetRevision: target.revision,
					targetLocation: target.location,
				};
				const unrelated = yield* readItemStackResolutionFx(base);
				const missingSource = yield* readItemStackResolutionFx({
					...base,
					sourceItemId: "runtime:missing",
				});
				const missingTarget = yield* readItemStackResolutionFx({
					...base,
					targetItemId: "runtime:missing",
				});
				const staleSourceRevision = yield* readItemStackResolutionFx({
					...base,
					sourceRevision: "revision:stale",
				});
				const staleTargetRevision = yield* readItemStackResolutionFx({
					...base,
					targetRevision: "revision:stale",
				});
				const staleSourceLocation = yield* readItemStackResolutionFx({
					...base,
					sourceLocation: board(3),
				});
				const nonGridRuntime = {
					...runtime,
					items: runtime.items.map((item) => {
						if (item.id !== source.id) {
							return item;
						}
						return {
							...item,
							location: {
								scope: "input" as const,
								ownerItemId: target.id,
								lineId: "line:producer:zero",
								inputIndex: 0,
							},
						};
					}),
				} satisfies RuntimeSchema.Type;
				const sourceNotOnGrid = yield* readItemStackResolutionFx({
					...base,
					runtime: nonGridRuntime,
				});
				const targetNotOnGrid = yield* readItemStackResolutionFx({
					...base,
					runtime: {
						...runtime,
						items: runtime.items.map((item) => {
							if (item.id !== target.id) {
								return item;
							}
							return {
								...item,
								location: {
									scope: "input" as const,
									ownerItemId: target.id,
									lineId: "line:producer:zero",
									inputIndex: 0,
								},
							};
						}),
					} satisfies RuntimeSchema.Type,
				});
				const sameItem = yield* readItemStackResolutionFx({
					...base,
					targetItemId: source.id,
					targetRevision: source.revision,
					targetLocation: source.location,
				});

				return {
					missingSource,
					missingTarget,
					sameItem,
					sourceNotOnGrid,
					staleSourceLocation,
					staleSourceRevision,
					staleTargetRevision,
					targetNotOnGrid,
					unrelated,
				};
			}).pipe(
				useGameFx({
					config: purityTestConfig,
				}),
			),
		);

		expect(result.unrelated).toEqual({
			kind: "unrelated",
			reason: "different-canonical-item",
		});
		expect(result.missingSource).toEqual({
			kind: "blocked",
			reason: "source-not-found",
		});
		expect(result.missingTarget).toEqual({
			kind: "blocked",
			reason: "target-not-found",
		});
		expect(result.staleSourceRevision).toEqual({
			kind: "blocked",
			reason: "stale-source-revision",
		});
		expect(result.staleTargetRevision).toEqual({
			kind: "blocked",
			reason: "stale-target-revision",
		});
		expect(result.staleSourceLocation).toEqual({
			kind: "blocked",
			reason: "stale-source-location",
		});
		expect(result.sourceNotOnGrid).toEqual({
			kind: "blocked",
			reason: "source-not-on-grid",
		});
		expect(result.targetNotOnGrid).toEqual({
			kind: "blocked",
			reason: "target-not-on-grid",
		});
		expect(result.sameItem).toEqual({
			kind: "blocked",
			reason: "same-item",
		});
	});
});
