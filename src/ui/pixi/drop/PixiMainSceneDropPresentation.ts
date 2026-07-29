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
	/** Directly manipulated actors whose next canonical pose should use the release spring. */
	readonly landingActorIds: ReadonlySet<string>;
	readonly pendingActorIds: ReadonlySet<string>;
	readonly relocations: ReadonlyArray<{
		readonly generation: number;
		readonly items: ReadonlyArray<{
			readonly itemId: string;
			readonly revision: string;
			readonly previousLocation: TileActorItem["location"];
			readonly location: TileActorItem["location"];
		}>;
	}>;
	readonly swaps: ReadonlyArray<{
		readonly candidate: PixiSceneSwapCandidate;
		readonly generation: number;
	}>;
}

export interface PixiMainSceneDropPresentation {
	readonly beginFx: (props: {
		/** Legacy single-source form retained for non-drop presentation callers and fixtures. */
		readonly sourceActorId?: string;
		readonly retainedActorIds?: ReadonlySet<string>;
		readonly swapCandidate: PixiSceneSwapCandidate | null;
	}) => Effect.Effect<number>;
	readonly clearSwapFx: (generation: number) => Effect.Effect<void>;
	readonly clearRelocationsFx: (generation: number) => Effect.Effect<void>;
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
