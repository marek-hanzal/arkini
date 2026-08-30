import type { Effect } from "effect";

import type { runTileDropAtom } from "~/ui/pixi/command/runTileDropAtom";
import type { TileActorItem } from "~/tile-presentation/type/TileActorItem";
import type { TileActorFeedbackCue } from "~/tile-presentation/type/TileActorFeedbackCue";

export interface SwapCandidate {
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

export interface DropSnapshot {
	readonly feedback: ReadonlyArray<{
		readonly cues: ReadonlyArray<TileActorFeedbackCue>;
		readonly generation: number;
	}>;
	readonly hiddenActorIds: ReadonlySet<string>;
	/** Directly manipulated actors whose next canonical pose should use the release spring. */
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
	}) => Effect.Effect<number>;
	readonly clearSwapFx: (generation: number) => Effect.Effect<void>;
	readonly clearFeedbackFx: (generation: number) => Effect.Effect<void>;
	readonly completeFx: (props: {
		readonly generation: number;
		readonly result: runTileDropAtom.Result;
	}) => Effect.Effect<void>;
	readonly failFx: (generation: number) => Effect.Effect<void>;
	readonly readSnapshotFx: Effect.Effect<DropSnapshot>;
	readonly reconcileActorIdsFx: (props: {
		readonly inventoryActorIds: ReadonlySet<string>;
		readonly mainActorIds: ReadonlySet<string>;
	}) => Effect.Effect<void>;
	readonly closeFx: Effect.Effect<void>;
}
