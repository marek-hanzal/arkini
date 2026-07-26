import { Effect } from "effect";

import { DropItemResultKindEnumSchema } from "~/bridge/tile/DropItemResultKindEnumSchema";
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

/** Owns generation-safe presentation facts from pointer release through canonical settlement. */
export const createPixiMainSceneDropPresentationFx = Effect.fn(
	"createPixiMainSceneDropPresentationFx",
)(() =>
	Effect.sync((): PixiMainSceneDropPresentation => {
		const hiddenActorIds = new Set<string>();
		let closed = false;
		let nextGeneration = 0;
		let pending: PendingDrop | null = null;
		let swap: PendingSwap | null = null;

		const clearGeneration = (generation: number) => {
			if (pending?.generation === generation) pending = null;
			if (swap?.generation === generation) swap = null;
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
			completeFx: Effect.fn("PixiMainSceneDropPresentation.completeFx")(
				({ generation, result }) =>
					Effect.sync(() => {
						if (closed || pending?.generation !== generation) return;
						pending = null;
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
				hiddenActorIds.clear();
				pending = null;
				swap = null;
			}),
		};
	}),
);
