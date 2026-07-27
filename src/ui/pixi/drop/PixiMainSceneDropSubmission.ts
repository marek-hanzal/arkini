import type { Effect } from "effect";

import type { TileActorItem } from "~/bridge/tile/TileActorItem";
import type { readTileDropPreviewFx } from "~/bridge/tile/readTileDropPreviewFx";
import type { PixiTileActor } from "~/ui/pixi/actor/PixiTileActor";
import type { PixiSceneDropTarget } from "~/ui/pixi/scene/PixiSceneDropTarget";

export interface PixiMainSceneDropSubmission {
	/** Reads the presentation owner's canonical pending claim without mirroring it. */
	readonly isPendingActorFx: (actorId: string) => Effect.Effect<boolean>;
	readonly submitFx: (request: {
		readonly actor: PixiTileActor;
		readonly previewKind: readTileDropPreviewFx.Result["kind"] | null;
		readonly shortcutReceiver?: {
			readonly actor: PixiTileActor;
			readonly pose: {
				readonly size: number;
				readonly x: number;
				readonly y: number;
			};
		};
		readonly sourceItem: TileActorItem;
		readonly target: PixiSceneDropTarget | null;
		readonly targetItem: TileActorItem | null;
	}) => Effect.Effect<void>;
	readonly closeFx: Effect.Effect<void>;
}
