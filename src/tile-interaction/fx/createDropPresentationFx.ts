import type { TileActorItem } from "~/tile-presentation/type/TileActorItem";
import { Effect } from "effect";
import { match } from "ts-pattern";

import type { TileActorFeedbackCue } from "~/tile-presentation/type/TileActorFeedbackCue";
import type { DropItemResult } from "~/item-interaction/type/DropItemResult";
import { DropItemResultKind } from "~/item-interaction/type/DropItemResult";

interface SwapCandidate {
	readonly source: {
		readonly id: string;
		readonly location: TileActorItem["location"];
		readonly revision: TileActorItem["revision"];
	};
	readonly target: {
		readonly id: string;
		readonly location: TileActorItem["location"];
		readonly revision: TileActorItem["revision"];
	};
}

interface DropSnapshot {
	readonly feedback: ReadonlyArray<{
		readonly cues: ReadonlyArray<TileActorFeedbackCue>;
		readonly generation: number;
	}>;
	readonly landingActorIds: ReadonlySet<string>;
	readonly pendingActorIds: ReadonlySet<string>;
	readonly swaps: ReadonlyArray<{
		readonly candidate: SwapCandidate;
		readonly generation: number;
	}>;
}

export interface DropPresentation {
	readonly beginFx: (props: {
		readonly sourceActorId: string;
		readonly swapCandidate: SwapCandidate | null;
	}) => Effect.Effect<number, never, never>;
	readonly clearSwapFx: (generation: number) => Effect.Effect<void, never, never>;
	readonly clearFeedbackFx: (generation: number) => Effect.Effect<void, never, never>;
	readonly completeFx: (props: {
		readonly generation: number;
		readonly result: DropItemResult;
	}) => Effect.Effect<void, never, never>;
	readonly failFx: (generation: number) => Effect.Effect<void, never, never>;
	readonly readSnapshotFx: Effect.Effect<DropSnapshot, never, never>;
	readonly reconcileActorsFx: () => Effect.Effect<void, never, never>;
	readonly closeFx: Effect.Effect<void, never, never>;
}

interface PendingDrop {
	readonly generation: number;
	readonly sourceActorId: string;
}

interface PendingSwap {
	readonly candidate: SwapCandidate;
	readonly generation: number;
}

interface PendingFeedback {
	readonly cues: ReadonlyArray<TileActorFeedbackCue>;
	readonly generation: number;
}

const readFeedbackCuesFn = (
	generation: number,
	result: DropItemResult,
): ReadonlyArray<TileActorFeedbackCue> =>
	match(result)

		.with(
			{
				kind: DropItemResultKind.StoreInput,
			},
			({ owner, source }) =>
				[
					{
						actorId: source.itemId,
						key: `drop:${generation}:consume-source`,
						kind: "consume-source",
					},
					{
						actorId: owner.itemId,
						key: `drop:${generation}:consume`,
						kind: "consume",
					},
				] satisfies TileActorFeedbackCue[],
		)
		.otherwise(() => []);

/**
 * Owns generation-safe presentation facts between pointer release and canonical reconciliation.
 *
 * These facts may retain or hide display actors and preserve exact swap candidates, but never
 * become gameplay truth. Independent generations let concurrent submissions reconcile without
 * one Promise completion clearing another drop's presentation work.
 */
export const createDropPresentationFx = Effect.fn("createDropPresentationFx")(() =>
	Effect.sync((): DropPresentation => {
		const feedback = new Map<number, PendingFeedback>();
		const landingActorIds = new Set<string>();
		let closed = false;
		let nextGeneration = 0;
		const pending = new Map<number, PendingDrop>();
		const swaps = new Map<number, PendingSwap>();

		const clearGenerationFn = (generation: number) => {
			pending.delete(generation);
			swaps.delete(generation);
			feedback.delete(generation);
		};

		return {
			beginFx: Effect.fn("DropPresentation.beginFx")(({ sourceActorId, swapCandidate }) =>
				Effect.sync(() => {
					if (closed) {
						throw new Error("Cannot begin a drop after presentation ownership closed.");
					}
					nextGeneration += 1;
					const generation = nextGeneration;
					pending.set(generation, {
						generation,
						sourceActorId,
					});
					if (swapCandidate !== null) {
						swaps.set(generation, {
							candidate: swapCandidate,
							generation,
						});
					}
					return generation;
				}),
			),
			clearSwapFx: Effect.fn("DropPresentation.clearSwapFx")((generation) =>
				Effect.sync(() => {
					swaps.delete(generation);
				}),
			),
			clearFeedbackFx: Effect.fn("DropPresentation.clearFeedbackFx")((generation) =>
				Effect.sync(() => {
					feedback.delete(generation);
				}),
			),
			completeFx: Effect.fn("DropPresentation.completeFx")(({ generation, result }) =>
				Effect.sync(() => {
					if (closed || !pending.delete(generation)) return;
					const cues = readFeedbackCuesFn(generation, result);
					if (cues.length > 0) {
						feedback.set(generation, {
							cues,
							generation,
						});
					}
					if (result.kind === DropItemResultKind.Move) {
						landingActorIds.add(result.itemId);
					}
					if (result.kind !== DropItemResultKind.Swap) {
						swaps.delete(generation);
					}
				}),
			),
			failFx: Effect.fn("DropPresentation.failFx")((generation) =>
				Effect.sync(() => {
					if (closed) return;
					clearGenerationFn(generation);
				}),
			),
			readSnapshotFx: Effect.sync(
				(): DropSnapshot => ({
					feedback: Array.from(feedback.values()),
					landingActorIds: new Set(landingActorIds),
					pendingActorIds: new Set(
						Array.from(pending.values(), ({ sourceActorId }) => sourceActorId),
					),
					swaps: Array.from(swaps.values()),
				}),
			),
			reconcileActorsFx: Effect.fn("DropPresentation.reconcileActorsFx")(() =>
				Effect.sync(() => {
					if (closed) return;
					landingActorIds.clear();
				}),
			),
			closeFx: Effect.sync(() => {
				if (closed) return;
				closed = true;
				landingActorIds.clear();
				pending.clear();
				swaps.clear();
				feedback.clear();
			}),
		};
	}),
);
