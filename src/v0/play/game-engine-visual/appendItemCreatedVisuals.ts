import type { BoardView } from "~/v0/board/view/BoardViewSchema";
import type { GameEvent } from "~/v0/game/engine/model/GameEventSchema";
import type { InventoryView } from "~/v0/inventory/view/InventoryViewSchema";
import { createGameVisualCreatedGroupId } from "~/v0/play/game-engine-visual/createGameVisualCreatedGroupId";
import { gameVisualMotionSettlementDelayMs } from "~/v0/play/game-engine-visual/gameVisualMotionSettlementDelayMs";
import { GameVisualMotion } from "~/v0/play/game-engine-visual/GameVisualMotion";
import type { GameEngineVisualPlanDraft } from "~/v0/play/game-engine-visual/GameEngineVisualPlanDraft";
import { readGameVisualCreatedCause } from "~/v0/play/game-engine-visual/readGameVisualCreatedCause";
import { toTileEngineEnterMotion } from "~/v0/play/game-engine-visual/toTileEngineEnterMotion";

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
