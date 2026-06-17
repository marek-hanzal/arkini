import type { QueryClient } from "@tanstack/react-query";
import { boardQueryKeys } from "~/v0/board/query/boardQueryKeys";
import { DebugTimeline } from "~/v0/debug/DebugTimeline";
import type { GameEngineRuntimeSnapshot } from "~/v0/game/engine/runtime/RuntimeGameEngineAdapter";
import { inventoryQueryKeys } from "~/v0/inventory/query/inventoryQueryKeys";
import { applyActionResultCachePatch } from "~/v0/play/cache/applyActionResultCachePatch";
import { createActionVisualEventsFromGameEngineResult } from "~/v0/play/game-engine-bridge/createActionVisualEventsFromGameEngineResult";
import { readRuntimeBoardViewFromGameSave } from "~/v0/play/game-engine-bridge/readRuntimeBoardViewFromGameSave";
import { readRuntimeInventoryViewFromGameSave } from "~/v0/play/game-engine-bridge/readRuntimeInventoryViewFromGameSave";
import type { RuntimeGameEngineAdapter } from "~/v0/game/engine/runtime/RuntimeGameEngineAdapter";
import { summarizeVisualEventGroups } from "~/v0/play/cache/summarizeVisualEventGroups";
import { summarizeVisualEvents } from "~/v0/play/cache/summarizeVisualEvents";

export namespace syncRuntimeGameEngineSnapshotToQueryCache {
	export interface Props {
		nowMs?: number;
		queryClient: QueryClient;
		snapshot: GameEngineRuntimeSnapshot;
	}
}

export const syncRuntimeGameEngineSnapshotToQueryCache = ({
	nowMs = Date.now(),
	queryClient,
	snapshot,
}: syncRuntimeGameEngineSnapshotToQueryCache.Props) => {
	const board = readRuntimeBoardViewFromGameSave({
		config: snapshot.config,
		nowMs,
		save: snapshot.save,
	});
	const inventory = readRuntimeInventoryViewFromGameSave({
		config: snapshot.config,
		save: snapshot.save,
	});

	DebugTimeline.record({
		detail: {
			boardItems: board.items.length,
			inventorySlots: inventory.slots.length,
			nextWakeAtMs: snapshot.nextWakeAtMs,
		},
		event: "runtime-snapshot.cache.sync",
		scope: "game-engine-runtime",
	});

	queryClient.setQueryData(boardQueryKeys.view, board);
	queryClient.setQueryData(inventoryQueryKeys.view, inventory);
};

export namespace connectRuntimeGameEngineToQueryCache {
	export interface Props {
		adapter: RuntimeGameEngineAdapter;
		nowMs?: number;
		prime?: boolean;
		queryClient: QueryClient;
	}
}

export const connectRuntimeGameEngineToQueryCache = ({
	adapter,
	nowMs = Date.now(),
	prime = true,
	queryClient,
}: connectRuntimeGameEngineToQueryCache.Props) => {
	if (prime) {
		syncRuntimeGameEngineSnapshotToQueryCache({
			nowMs,
			queryClient,
			snapshot: adapter.readSnapshot(),
		});
	}

	return adapter.subscribe((result) => {
		const visualEvents = createActionVisualEventsFromGameEngineResult({
			result,
		});

		DebugTimeline.record({
			detail: {
				domainCount: result.events.length,
				domainTypes: result.events.map((event) => event.type),
				visualCount: visualEvents.length,
				visualEvents: summarizeVisualEvents(visualEvents),
				visualGroups: summarizeVisualEventGroups(visualEvents),
			},
			event: "runtime-result.visual-cache.apply",
			scope: "game-engine-runtime",
		});

		if (visualEvents.length === 0) return;

		applyActionResultCachePatch({
			queryClient,
			result: {
				visualEvents,
			},
		});
	});
};
