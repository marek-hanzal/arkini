import type { Effect } from "effect";

import type { TileActorItem } from "~/ui/pixi/actor/TileActorItem";
import type { readTileDropPreviewFx } from "~/ui/pixi/drag/readTileDropPreviewFx";
import type { runTileDropAtom } from "~/ui/pixi/command/runTileDropAtom";
import type { PixiTileActor } from "~/ui/pixi/actor/PixiTileActor";

export interface DropSubmission {
	/** Reads the presentation owner's canonical pending claim without mirroring it. */
	readonly isPendingActorFx: (actorId: string) => Effect.Effect<boolean>;
	readonly submitFx: (request: {
		readonly actor: PixiTileActor;
		readonly commandTarget: runTileDropAtom.Command["target"];
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
		readonly targetItem: TileActorItem | null;
	}) => Effect.Effect<void>;
	readonly closeFx: Effect.Effect<void>;
}
