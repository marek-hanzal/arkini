import type { Effect } from "effect";

import type { TileActorItem } from "~/tile-presentation/type/TileActorItem";
import type { readTileDropPreviewFx } from "~/ui/pixi/drag/readTileDropPreviewFx";
import type { ActiveDrag } from "~/ui/pixi/drag/ActiveDrag";
import type { TargetFacts } from "~/ui/pixi/scene/MainSurface";

/** Canonical source and engine-preview projection over one explicit drag snapshot. */
export interface DragPreview {
	readonly previewTargetFx: (props: {
		readonly drag: ActiveDrag;
		readonly force?: boolean;
		readonly targetFacts: TargetFacts;
	}) => Effect.Effect<TileActorItem | null>;
	readonly readCurrentSourceFx: (drag: ActiveDrag) => Effect.Effect<TileActorItem | null>;
	readonly readPreviewKindFx: (props: {
		readonly sourceItem: TileActorItem;
		readonly targetFacts: TargetFacts;
	}) => Effect.Effect<readTileDropPreviewFx.Result["kind"]>;
	readonly refreshAttractionEligibilityFx: (props: {
		readonly candidateActorIds: ReadonlyArray<string>;
		readonly drag: ActiveDrag;
		readonly sourceItem: TileActorItem;
		readonly targetFacts: TargetFacts;
	}) => Effect.Effect<void>;
}
