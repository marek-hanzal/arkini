import type { TileActorItem } from "~/tile-presentation/type/TileActorItem";
import { Effect } from "effect";

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

/**
 * Owns generation-safe presentation facts between pointer release and canonical reconciliation.
 *
 * These facts may retain or hide display actors and preserve exact swap candidates, but never
 * become gameplay truth. Independent generations let concurrent submissions reconcile without
 * one Promise completion clearing another drop's presentation work.
 */
export const createDropPresentationFx = Effect.fn("createDropPresentationFx")(() =>
	Effect.sync((): DropPresentation => {
		const landingActorIds = new Set<string>();
		let closed = false;
		let nextGeneration = 0;
		const pending = new Map<number, PendingDrop>();
		const swaps = new Map<number, PendingSwap>();

		const clearGenerationFn = (generation: number) => {
			pending.delete(generation);
			swaps.delete(generation);
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
			completeFx: Effect.fn("DropPresentation.completeFx")(({ generation, result }) =>
				Effect.sync(() => {
					if (closed || !pending.delete(generation)) return;
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
			}),
		};
	}),
);
