import type { Effect } from "effect";

import type { TileActorItem } from "~/bridge/tile/TileActorItem";
import type { PixiTileActor } from "~/ui/pixi/actor/PixiTileActor";

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

export interface PixiMainSceneDragController {
	readonly attachActorFx: (actor: PixiTileActor) => Effect.Effect<void>;
	readonly cancelInteractionFx: Effect.Effect<void>;
	readonly clearSwapCandidateFx: Effect.Effect<void>;
	readonly detachActorFx: (actor: PixiTileActor) => Effect.Effect<void>;
	readonly refreshPreviewFx: Effect.Effect<void>;
	readonly readSwapCandidateFx: Effect.Effect<PixiSceneSwapCandidate | null>;
	readonly setInteractionBlockedFx: (blocked: boolean) => Effect.Effect<void>;
	readonly closeFx: Effect.Effect<void>;
}
