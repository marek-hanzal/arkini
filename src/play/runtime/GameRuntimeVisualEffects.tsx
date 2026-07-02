import { type FC, useEffect } from "react";
import { applyGameEngineVisualPlan } from "~/play/game-engine-visual/applyGameEngineVisualPlan";
import { createGameEngineVisualPlan } from "~/play/game-engine-visual/createGameEngineVisualPlan";
import { readBoardView } from "~/play/runtime/readers/readBoardView";
import { readInventoryView } from "~/play/runtime/readers/readInventoryView";
import type { GameRuntimeStore } from "~/play/runtime/GameRuntimeStore";

export namespace GameRuntimeVisualEffects {
	export interface Props {
		store: GameRuntimeStore;
	}
}

export const GameRuntimeVisualEffects: FC<GameRuntimeVisualEffects.Props> = ({ store }) => {
	useEffect(
		() =>
			store.subscribeUpdate((update) => {
				const plan = createGameEngineVisualPlan({
					currentBoard: readBoardView(update.current),
					currentInventory: readInventoryView(update.current),
					events: update.result.events,
					previousBoard: readBoardView(update.previous),
				});

				if (
					plan.boardEnterRequests.length === 0 &&
					plan.boardFeedbackRequests.length === 0 &&
					plan.boardTransientTilePlans.length === 0 &&
					plan.inventoryEnterRequests.length === 0
				) {
					return;
				}

				applyGameEngineVisualPlan({
					plan,
				});
			}),
		[
			store,
		],
	);

	return null;
};
