import type { Command } from "~/command/Command";
import type { ItemId } from "~/manifest/manifestId";
import type { DraggablePayload } from "~/drag/DraggablePayload";
import type { DropContext } from "~/drag/DropContext";
import type { DroppablePayload } from "~/drag/DroppablePayload";
import type { GameDragView } from "~/play/logic/playTypes";
import type { DragSource, DropTarget, VisualMeta } from "~/play/types";

export interface Feedback {
	pulseMergeCell(key: string | undefined): void;
	pulseImprintCell(key: string | undefined): void;
	flashBoardCell(key: string | undefined, tone: "error"): void;
	flashInventorySlot(slotIndex: number | undefined, tone: "error"): void;
	showError(error: unknown): void;
}

export interface Runtime {
	game: GameDragView;
	feedback: Feedback;
	run(command: Command): Promise<unknown>;
}

export type SourceKind = DragSource["kind"];
export type TargetKind = DropTarget["kind"];

export type TypedDropContext<Source extends SourceKind, Target extends TargetKind> = {
	source: DraggablePayload<
		ItemId,
		Extract<
			DragSource,
			{
				kind: Source;
			}
		>,
		VisualMeta
	>;
	target: DroppablePayload<
		Extract<
			DropTarget,
			{
				kind: Target;
			}
		>
	>;
};

export type AnyDropContext = DropContext<ItemId, DragSource, DropTarget, VisualMeta>;
