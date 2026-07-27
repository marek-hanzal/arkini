import type { Effect } from "effect";

import type { runTileDropAtom } from "~/bridge/tile/runTileDropAtom";
import type { TileActorItem } from "~/bridge/tile/TileActorItem";
import type { TileActorFeedbackCue } from "~/bridge/tile/feedback/TileActorFeedbackCue";

export interface PixiSceneSwapCandidate {
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

export interface PixiMainSceneDropPresentationSnapshot {
	readonly feedback: ReadonlyArray<{
		readonly cues: ReadonlyArray<TileActorFeedbackCue>;
		readonly generation: number;
	}>;
	readonly hiddenActorIds: ReadonlySet<string>;
	readonly pendingActorIds: ReadonlySet<string>;
	readonly swaps: ReadonlyArray<{
		readonly candidate: PixiSceneSwapCandidate;
		readonly generation: number;
	}>;
}

export interface PixiMainSceneDropPresentation {
	readonly beginFx: (props: {
		readonly sourceActorId: string;
		readonly swapCandidate: PixiSceneSwapCandidate | null;
	}) => Effect.Effect<number>;
	readonly clearSwapFx: (generation: number) => Effect.Effect<void>;
	readonly clearFeedbackFx: (generation: number) => Effect.Effect<void>;
	readonly completeFx: (props: {
		readonly generation: number;
		readonly result: runTileDropAtom.Result;
	}) => Effect.Effect<void>;
	readonly failFx: (generation: number) => Effect.Effect<void>;
	readonly readSnapshotFx: Effect.Effect<PixiMainSceneDropPresentationSnapshot>;
	readonly reconcileActorIdsFx: (props: {
		readonly inventoryActorIds: ReadonlySet<string>;
		readonly mainActorIds: ReadonlySet<string>;
	}) => Effect.Effect<void>;
	readonly closeFx: Effect.Effect<void>;
}
