import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { useGameFx } from "~test/support/game/useGameFx";
import { spawnItemFx } from "~test/support/runtime/spawnItemFx";
import { readRuntimeFx } from "~/game-runtime/read/readRuntimeFx";
import type { RuntimeSchema } from "~/game-runtime/schema/RuntimeSchema";
import { readItemStackResolutionFn } from "~/item-interaction/fn/readItemStackResolutionFn";
import { purityTestConfig } from "~test/production-line/support/purityTestConfig";

const board = (x: number) => ({
	scope: "board" as const,
	space: 0,
	position: {
		x,
		y: 0,
	},
});

describe("readItemStackResolutionFn", () => {
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
				const unrelated = readItemStackResolutionFn(base);
				const missingSource = readItemStackResolutionFn({
					...base,
					sourceItemId: "runtime:missing",
				});
				const missingTarget = readItemStackResolutionFn({
					...base,
					targetItemId: "runtime:missing",
				});
				const staleSourceRevision = readItemStackResolutionFn({
					...base,
					sourceRevision: "revision:stale",
				});
				const staleTargetRevision = readItemStackResolutionFn({
					...base,
					targetRevision: "revision:stale",
				});
				const staleSourceLocation = readItemStackResolutionFn({
					...base,
					sourceLocation: board(3),
				});
				const sourceNotOnGrid = readItemStackResolutionFn({
					...base,
					runtime: {
						...runtime,
						items: runtime.items.map((item) =>
							item.id !== source.id
								? item
								: {
										...item,
										location: {
											scope: "input" as const,
											ownerItemId: target.id,
											lineId: "line:producer:zero",
											inputIndex: 0,
										},
									},
						),
					} satisfies RuntimeSchema.Type,
				});
				const targetNotOnGrid = readItemStackResolutionFn({
					...base,
					runtime: {
						...runtime,
						items: runtime.items.map((item) =>
							item.id !== target.id
								? item
								: {
										...item,
										location: {
											scope: "input" as const,
											ownerItemId: target.id,
											lineId: "line:producer:zero",
											inputIndex: 0,
										},
									},
						),
					} satisfies RuntimeSchema.Type,
				});
				const sameItem = readItemStackResolutionFn({
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
