import type { Effect } from "effect";

import type { TileActorItem } from "~/bridge/tile/TileActorItem";
import type { readTileDropPreviewFx } from "~/bridge/tile/readTileDropPreviewFx";
import type { PixiMainSceneActiveDrag } from "~/ui/pixi/drag/PixiMainSceneDragState";
import type { PixiMainSceneTargetFacts } from "~/ui/pixi/scene/PixiMainSceneSurface";

/** Canonical source and engine-preview projection over one explicit drag snapshot. */
export interface PixiMainSceneDragPreview {
	readonly previewTargetFx: (props: {
		readonly drag: PixiMainSceneActiveDrag;
		readonly force?: boolean;
		readonly targetFacts: PixiMainSceneTargetFacts;
	}) => Effect.Effect<TileActorItem | null>;
	readonly readCurrentSourceFx: (
		drag: PixiMainSceneActiveDrag,
	) => Effect.Effect<TileActorItem | null>;
	readonly readPreviewKindFx: (props: {
		readonly sourceItem: TileActorItem;
		readonly targetFacts: PixiMainSceneTargetFacts;
	}) => Effect.Effect<readTileDropPreviewFx.Result["kind"]>;
	readonly refreshAttractionEligibilityFx: (props: {
		readonly candidateActorIds: ReadonlyArray<string>;
		readonly drag: PixiMainSceneActiveDrag;
		readonly sourceItem: TileActorItem;
		readonly targetFacts: PixiMainSceneTargetFacts;
	}) => Effect.Effect<void>;
}
