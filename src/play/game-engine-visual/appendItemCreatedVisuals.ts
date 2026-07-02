import type { BoardView } from "~/board/view/BoardViewSchema";
import type { GameEvent } from "~/event/GameEventSchema";
import type { InventoryView } from "~/inventory/view/InventoryViewSchema";
import { createGameVisualCreatedGroupId } from "~/play/game-engine-visual/createGameVisualCreatedGroupId";
import { gameVisualMotionSettlementDelayMs } from "~/play/game-engine-visual/gameVisualMotionSettlementDelayMs";
import { GameVisualMotion } from "~/play/game-engine-visual/GameVisualMotion";
import type { GameEngineVisualPlanDraft } from "~/play/game-engine-visual/GameEngineVisualPlanDraft";
import { readGameVisualCreatedCause } from "~/play/game-engine-visual/readGameVisualCreatedCause";
import { toTileEngineEnterMotion } from "~/play/game-engine-visual/toTileEngineEnterMotion";

type CreatedEvent = Extract<
	GameEvent,
	{
		type: "item.created";
	}
>;

export namespace appendItemCreatedVisuals {
	export interface Props {
		currentBoard: BoardView | undefined;
		currentInventory: InventoryView | undefined;
		event: CreatedEvent;
		plan: GameEngineVisualPlanDraft;
		sequenceIndex: number;
	}
}

export const appendItemCreatedVisuals = ({
	currentBoard,
	currentInventory,
	event,
	plan,
	sequenceIndex,
}: appendItemCreatedVisuals.Props) => {
	if (event.to.kind === "board") {
		if (!currentBoard?.byId[event.to.itemInstanceId]) return;

		const motion = GameVisualMotion.sequenceFadeIn({
			cause: readGameVisualCreatedCause(event.reason),
			groupId: createGameVisualCreatedGroupId(event),
			sequenceIndex,
		});
		plan.boardEnterRequests.push({
			cleanupDelayMs: gameVisualMotionSettlementDelayMs(motion),
			enter: toTileEngineEnterMotion(motion, {
				fromTileId: event.originItemInstanceId,
			}),
			tileId: event.to.itemInstanceId,
		});
		return;
	}

	const slot = currentInventory?.bySlotIndex[String(event.to.slotIndex)];
	const stack = slot?.stack;
	if (!stack) return;

	// Inventory quantity changes are already reflected by the runtime snapshot.
	// Keep this branch explicit so item.created remains fully accounted for without
	// inventing a second inventory animation event language.
};
