import { Effect } from "effect";
import { match } from "ts-pattern";

import type { TileActorFeedbackCue } from "~/bridge/tile/feedback/TileActorFeedbackCue";
import { DropItemResultKindEnumSchema } from "~/bridge/tile/DropItemResultKindEnumSchema";
import type { runTileDropAtom } from "~/bridge/tile/runTileDropAtom";
import type {
	DropPresentation,
	DropSnapshot,
	SwapCandidate,
} from "~/ui/pixi/drop/DropPresentation";

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

const readFeedbackCues = (
	generation: number,
	result: runTileDropAtom.Result,
): ReadonlyArray<TileActorFeedbackCue> =>
	match(result)
		.with(
			{
				kind: DropItemResultKindEnumSchema.enum.Stack,
			},
			({ source, target }) =>
				[
					{
						actorId: source.itemId,
						key: `drop:${generation}:consume-source`,
						kind: "consume-source",
					},
					{
						actorId: target.itemId,
						key: `drop:${generation}:consume`,
						kind: "consume",
					},
				] satisfies TileActorFeedbackCue[],
		)
		.with(
			{
				kind: DropItemResultKindEnumSchema.enum.StoreInput,
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
		.with(
			{
				kind: DropItemResultKindEnumSchema.enum.StoreInventory,
			},
			({ inventory, source }) =>
				[
					{
						actorId: source.itemId,
						key: `drop:${generation}:consume-source`,
						kind: "consume-source",
					},
					{
						actorId: inventory.itemId,
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
		const hiddenActorIds = new Set<string>();
		const landingActorIds = new Set<string>();
		let closed = false;
		let nextGeneration = 0;
		const pending = new Map<number, PendingDrop>();
		const swaps = new Map<number, PendingSwap>();

		const clearGeneration = (generation: number) => {
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
					const cues = readFeedbackCues(generation, result);
					if (cues.length > 0) {
						feedback.set(generation, {
							cues,
							generation,
						});
					}
					if (
						result.kind === DropItemResultKindEnumSchema.enum.StoreInventory ||
						(result.kind === DropItemResultKindEnumSchema.enum.Stack &&
							result.source.current === null)
					) {
						hiddenActorIds.add(result.source.itemId);
					}
					if (result.kind === DropItemResultKindEnumSchema.enum.Move) {
						landingActorIds.add(result.itemId);
					}
					if (result.kind !== DropItemResultKindEnumSchema.enum.Swap) {
						swaps.delete(generation);
					}
				}),
			),
			failFx: Effect.fn("DropPresentation.failFx")((generation) =>
				Effect.sync(() => {
					if (closed) return;
					clearGeneration(generation);
				}),
			),
			readSnapshotFx: Effect.sync(
				(): DropSnapshot => ({
					feedback: Array.from(feedback.values()),
					hiddenActorIds: new Set(hiddenActorIds),
					landingActorIds: new Set(landingActorIds),
					pendingActorIds: new Set(
						Array.from(pending.values(), ({ sourceActorId }) => sourceActorId),
					),
					swaps: Array.from(swaps.values()),
				}),
			),
			reconcileActorIdsFx: Effect.fn("DropPresentation.reconcileActorIdsFx")(
				({ inventoryActorIds, mainActorIds }) =>
					Effect.sync(() => {
						if (closed) return;
						for (const actorId of hiddenActorIds) {
							if (mainActorIds.has(actorId) && !inventoryActorIds.has(actorId))
								continue;
							hiddenActorIds.delete(actorId);
						}
						landingActorIds.clear();
					}),
			),
			closeFx: Effect.sync(() => {
				if (closed) return;
				closed = true;
				hiddenActorIds.clear();
				landingActorIds.clear();
				pending.clear();
				swaps.clear();
				feedback.clear();
			}),
		};
	}),
);
