import { type FC, useEffect } from "react";
import { DebugTimeline } from "~/v0/debug/DebugTimeline";
import { applyGameEngineVisualPlan } from "~/v0/play/game-engine-visual/applyGameEngineVisualPlan";
import { createGameEngineVisualPlan } from "~/v0/play/game-engine-visual/createGameEngineVisualPlan";
import { summarizeGameEngineVisualPlan } from "~/v0/play/game-engine-visual/summarizeGameEngineVisualPlan";
import { readGameRuntimeBoardView, readGameRuntimeInventoryView } from "~/v0/play/runtime/readers";
import type { GameRuntimeStore } from "~/v0/play/runtime/GameRuntimeStore";

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
					currentBoard: readGameRuntimeBoardView(update.current),
					currentInventory: readGameRuntimeInventoryView(update.current),
					events: update.result.events,
					previousBoard: readGameRuntimeBoardView(update.previous),
				});

				DebugTimeline.record({
					detail: {
						domainCount: update.result.events.length,
						domainTypes: update.result.events.map((event) => event.type),
						visualPlan: summarizeGameEngineVisualPlan(plan),
					},
					event: "runtime-result.visual-plan.apply",
					scope: "game-engine-runtime",
				});

				if (
					plan.boardEnterRequests.length === 0 &&
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
