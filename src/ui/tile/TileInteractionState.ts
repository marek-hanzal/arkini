import type { useDropItemPreview } from "~/bridge/tile/useDropItemPreview";
import type { TileDragSource } from "~/ui/tile/TileDragSource";
import type { TileDropTarget } from "~/ui/tile/TileDropTarget";
import type { TileInteractionPhaseSchema } from "~/ui/tile/schema/TileInteractionPhaseSchema";

interface TileInteractionBase {
	readonly source: TileDragSource;
	readonly generation: number;
}

export interface TilePressedInteraction extends TileInteractionBase {
	readonly phase: Extract<TileInteractionPhaseSchema.Type, "pressed">;
}

export interface TileDraggingInteraction extends TileInteractionBase {
	readonly phase: Extract<TileInteractionPhaseSchema.Type, "dragging">;
	readonly target: TileDropTarget | null;
	readonly previewKind: useDropItemPreview.Result["kind"] | null;
}

export interface TileAwaitingOutcomeInteraction extends TileInteractionBase {
	readonly phase: Extract<TileInteractionPhaseSchema.Type, "awaiting-outcome">;
	readonly target: TileDropTarget;
	readonly previewKind: useDropItemPreview.Result["kind"] | null;
}

/** Arkini-owned state for the one active tile gesture. */
export type TileInteractionState =
	| TilePressedInteraction
	| TileDraggingInteraction
	| TileAwaitingOutcomeInteraction;
