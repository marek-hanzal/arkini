import { Effect } from "effect";
import { match } from "ts-pattern";

import type { TileActorFeedbackCue } from "~/bridge/tile/feedback/TileActorFeedbackCue";
import { DropItemResultKindEnumSchema } from "~/bridge/tile/DropItemResultKindEnumSchema";
import type { runTileDropAtom } from "~/bridge/tile/runTileDropAtom";
import type {
	PixiMainSceneDropPresentation,
	PixiMainSceneDropPresentationSnapshot,
	PixiSceneSwapCandidate,
} from "~/ui/pixi/drop/PixiMainSceneDropPresentation";

interface PendingDrop {
	readonly generation: number;
	readonly sourceActorId: string;
}

interface PendingSwap {
	readonly candidate: PixiSceneSwapCandidate;
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
 * These facts may retain or hide a display actor and preserve an exact swap candidate, but never
 * become gameplay truth. Generations make stale Promise completion unable to clear newer work.
 */
export const createPixiMainSceneDropPresentationFx = Effect.fn(
	"createPixiMainSceneDropPresentationFx",
)(() =>
	Effect.sync((): PixiMainSceneDropPresentation => {
		let feedback: PendingFeedback | null = null;
		const hiddenActorIds = new Set<string>();
		let closed = false;
		let nextGeneration = 0;
		let pending: PendingDrop | null = null;
		let swap: PendingSwap | null = null;

		const clearGeneration = (generation: number) => {
			if (pending?.generation === generation) pending = null;
			if (swap?.generation === generation) swap = null;
			if (feedback?.generation === generation) feedback = null;
		};

		return {
			beginFx: Effect.fn("PixiMainSceneDropPresentation.beginFx")(
				({ sourceActorId, swapCandidate }) =>
					Effect.sync(() => {
						if (closed) {
							throw new Error(
								"Cannot begin a drop after presentation ownership closed.",
							);
						}
						nextGeneration += 1;
						const generation = nextGeneration;
						pending = {
							generation,
							sourceActorId,
						};
						swap =
							swapCandidate === null
								? null
								: {
										candidate: swapCandidate,
										generation,
									};
						return generation;
					}),
			),
			clearSwapFx: Effect.fn("PixiMainSceneDropPresentation.clearSwapFx")((generation) =>
				Effect.sync(() => {
					if (swap?.generation === generation) swap = null;
				}),
			),
			clearFeedbackFx: Effect.fn("PixiMainSceneDropPresentation.clearFeedbackFx")(
				(generation) =>
					Effect.sync(() => {
						if (feedback?.generation === generation) feedback = null;
					}),
			),
			completeFx: Effect.fn("PixiMainSceneDropPresentation.completeFx")(
				({ generation, result }) =>
					Effect.sync(() => {
						if (closed || pending?.generation !== generation) return;
						pending = null;
						const cues = readFeedbackCues(generation, result);
						feedback =
							cues.length === 0
								? null
								: {
										cues,
										generation,
									};
						if (result.kind === DropItemResultKindEnumSchema.enum.StoreInventory) {
							hiddenActorIds.add(result.source.itemId);
						}
						if (result.kind !== DropItemResultKindEnumSchema.enum.Swap) {
							if (swap?.generation === generation) swap = null;
						}
					}),
			),
			failFx: Effect.fn("PixiMainSceneDropPresentation.failFx")((generation) =>
				Effect.sync(() => {
					if (closed) return;
					clearGeneration(generation);
				}),
			),
			readSnapshotFx: Effect.sync(
				(): PixiMainSceneDropPresentationSnapshot => ({
					feedback:
						feedback === null
							? null
							: {
									cues: feedback.cues,
									generation: feedback.generation,
								},
					hiddenActorIds: new Set(hiddenActorIds),
					pendingActorIds:
						pending === null
							? new Set()
							: new Set([
									pending.sourceActorId,
								]),
					swap:
						swap === null
							? null
							: {
									candidate: swap.candidate,
									generation: swap.generation,
								},
				}),
			),
			reconcileActorIdsFx: Effect.fn("PixiMainSceneDropPresentation.reconcileActorIdsFx")(
				({ inventoryActorIds, mainActorIds }) =>
					Effect.sync(() => {
						if (closed) return;
						for (const actorId of hiddenActorIds) {
							if (mainActorIds.has(actorId) && !inventoryActorIds.has(actorId))
								continue;
							hiddenActorIds.delete(actorId);
						}
					}),
			),
			closeFx: Effect.sync(() => {
				if (closed) return;
				closed = true;
				feedback = null;
				hiddenActorIds.clear();
				pending = null;
				swap = null;
			}),
		};
	}),
);
