import type { TileActorItem } from "~/tile-presentation/type/TileActorItem";
import type { readTileDropPreviewFx } from "~/ui/pixi/drag/readTileDropPreviewFx";
import type { PixiTileActor } from "~/ui/pixi/actor/PixiTileActor";
import type { MainActivationIntent } from "~/ui/pixi/scene/MainActivationIntent";
import type { PixiSceneDropTarget } from "~/ui/pixi/scene/PixiSceneDropTarget";

interface ActiveDragBase {
	readonly actor: PixiTileActor;
	readonly activationIntent: MainActivationIntent;
	readonly pointerId: number;
	readonly pressX: number;
	readonly pressY: number;
	readonly sourceItem: TileActorItem;
	readonly startX: number;
	readonly startY: number;
	attractionEligibilityByActorId: Map<
		string,
		{
			readonly eligible: boolean;
			readonly source: Pick<TileActorItem, "id" | "location" | "revision">;
			readonly target: Pick<TileActorItem, "id" | "location" | "revision">;
		}
	>;
	eligibleAttractionActorIds: ReadonlySet<string>;
	lastPointerX: number;
	lastPointerY: number;
	previewKind: readTileDropPreviewFx.Result["kind"] | null;
	previewSource: Pick<TileActorItem, "id" | "location" | "revision"> | null;
	target: PixiSceneDropTarget | null;
	targetKey: string;
	targetItem: TileActorItem | null;
}

interface MotionHandoffGesture extends ActiveDragBase {
	readonly mode: "motion-handoff";
	readonly phase: "pressed";
}

interface ActivationOnlyGesture extends ActiveDragBase {
	readonly mode: "activation-only";
	readonly phase: "pressed";
}

interface MovableGesture extends ActiveDragBase {
	readonly mode: "drag";
	phase: "dragging" | "pressed";
}

export type ActiveDrag = ActivationOnlyGesture | MotionHandoffGesture | MovableGesture;
