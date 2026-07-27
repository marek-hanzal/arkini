import type { TileActorItem } from "~/bridge/tile/TileActorItem";
import type { readTileDropPreviewFx } from "~/bridge/tile/readTileDropPreviewFx";
import type { PixiTileActor } from "~/ui/pixi/actor/PixiTileActor";
import type { PixiSceneDropTarget } from "~/ui/pixi/scene/PixiSceneDropTarget";

interface PixiMainSceneActiveDragBase {
	readonly actor: PixiTileActor;
	readonly openDetail: boolean;
	readonly pointerId: number;
	readonly pressX: number;
	readonly pressY: number;
	readonly sourceItem: TileActorItem;
	readonly startX: number;
	readonly startY: number;
	eligibleAttractionActorIds: ReadonlySet<string>;
	lastPointerX: number;
	lastPointerY: number;
	previewKind: readTileDropPreviewFx.Result["kind"] | null;
	target: PixiSceneDropTarget | null;
	targetItem: TileActorItem | null;
}

export interface PixiMainSceneMotionHandoffGesture extends PixiMainSceneActiveDragBase {
	readonly mode: "motion-handoff";
	readonly phase: "pressed";
}

export interface PixiMainSceneActivationOnlyGesture extends PixiMainSceneActiveDragBase {
	readonly mode: "activation-only";
	readonly phase: "pressed";
}

export interface PixiMainSceneMovableGesture extends PixiMainSceneActiveDragBase {
	readonly mode: "drag";
	phase: "dragging" | "pressed" | "submitting";
}

export type PixiMainSceneActiveDrag =
	| PixiMainSceneActivationOnlyGesture
	| PixiMainSceneMotionHandoffGesture
	| PixiMainSceneMovableGesture;
