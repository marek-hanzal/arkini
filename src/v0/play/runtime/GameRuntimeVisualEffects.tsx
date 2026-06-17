import { type FC, useEffect } from "react";
import { DebugTimeline } from "~/v0/debug/DebugTimeline";
import { createActionVisualEventsFromGameEngineResult } from "~/v0/play/game-engine-bridge";
import { summarizeVisualEventGroups } from "~/v0/play/visual-events/summarizeVisualEventGroups";
import { summarizeVisualEvents } from "~/v0/play/visual-events/summarizeVisualEvents";
import { registerBoardMergeExitTiles } from "~/v0/play/tile-engine-motion/registerBoardMergeExitTiles";
import { registerTileEngineEnterRequests } from "~/v0/play/tile-engine-motion/registerTileEngineEnterRequests";
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
				const visualEvents = createActionVisualEventsFromGameEngineResult({
					result: update.result,
				});

				DebugTimeline.record({
					detail: {
						domainCount: update.result.events.length,
						domainTypes: update.result.events.map((event) => event.type),
						visualCount: visualEvents.length,
						visualEvents: summarizeVisualEvents(visualEvents),
						visualGroups: summarizeVisualEventGroups(visualEvents),
					},
					event: "runtime-result.visual-effects.apply",
					scope: "game-engine-runtime",
				});

				if (visualEvents.length === 0) return;

				registerBoardMergeExitTiles({
					board: update.previous.board,
					events: visualEvents,
				});
				registerTileEngineEnterRequests({
					board: update.current.board,
					events: visualEvents,
					inventory: update.current.inventory,
				});
			}),
		[
			store,
		],
	);

	return null;
};
