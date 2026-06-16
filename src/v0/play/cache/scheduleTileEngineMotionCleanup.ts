import type { QueryClient } from "@tanstack/react-query";
import { patchBoardViewCache } from "~/v0/board/cache/patchBoardViewCache";
import { rebuildBoardView } from "~/v0/board/view/rebuildBoardView";
import { DebugTimeline } from "~/v0/debug/DebugTimeline";
import { patchInventorySlotCache } from "~/v0/inventory/cache/patchInventorySlotCache";
import { patchInventoryViewCache } from "~/v0/inventory/cache/patchInventoryViewCache";
import type { ActionVisualAnimationSchema } from "~/v0/play/action/ActionVisualAnimationSchema";
import type { ActionVisualEventSchema } from "~/v0/play/action/ActionVisualEventSchema";
import { clearTileEngineEnterMotion } from "~/v0/play/tile-engine-motion/clearTileEngineEnterMotion";
import { TileEngineTiming } from "~/v0/tile-engine/TileEngineTiming";

export namespace scheduleTileEngineMotionCleanup {
	export interface Props {
		queryClient: QueryClient;
		events: readonly ActionVisualEventSchema.Type[];
	}
}

type CleanupTarget =
	| {
			kind: "board";
			itemInstanceId: string;
			animation: ActionVisualAnimationSchema.Type;
	  }
	| {
			kind: "inventory";
			slotIndex: number;
			animation: ActionVisualAnimationSchema.Type;
	  };

export const tileEngineMotionCleanupDelayMs = (animation: ActionVisualAnimationSchema.Type) =>
	(animation.delayMs ?? 0) +
	(animation.durationMs ?? TileEngineTiming.presenceDurationSeconds * 1000) +
	TileEngineTiming.motionCleanupBufferMs;

const cleanupTargetsForEvent = (event: ActionVisualEventSchema.Type): readonly CleanupTarget[] => {
	if (event.type === "item.merged") {
		return [
			{
				kind: "board",
				itemInstanceId: event.targetItemInstanceId,
				animation: event.animation,
			},
		];
	}

	if (event.type !== "item.spawned") return [];

	if (event.to.kind === "board" && event.itemInstanceId) {
		return [
			{
				kind: "board",
				itemInstanceId: event.itemInstanceId,
				animation: event.animation,
			},
		];
	}

	if (event.to.kind === "inventory") {
		return [
			{
				kind: "inventory",
				slotIndex: event.to.slotIndex,
				animation: event.animation,
			},
		];
	}

	return [];
};

const cleanupBoardMotion = ({
	groupId,
	itemInstanceId,
	queryClient,
}: {
	queryClient: QueryClient;
	groupId: string;
	itemInstanceId: string;
}) =>
	patchBoardViewCache({
		queryClient,
		patch: (board) =>
			rebuildBoardView(
				board.items.map((item) => {
					if (item.id !== itemInstanceId) return item;

					const motion = clearTileEngineEnterMotion(item.motion, groupId);
					if (motion === item.motion) return item;

					return {
						...item,
						motion,
					};
				}),
			),
	});

const cleanupInventoryMotion = ({
	groupId,
	queryClient,
	slotIndex,
}: {
	queryClient: QueryClient;
	groupId: string;
	slotIndex: number;
}) =>
	patchInventoryViewCache({
		queryClient,
		patch: (inventory) =>
			patchInventorySlotCache({
				inventory,
				slotIndex,
				patch: (slot) => {
					if (!slot.stack) return slot;

					const motion = clearTileEngineEnterMotion(slot.stack.motion, groupId);
					if (motion === slot.stack.motion) return slot;

					return {
						...slot,
						stack: {
							...slot.stack,
							motion,
						},
					};
				},
			}),
	});

export const scheduleTileEngineMotionCleanup = ({
	events,
	queryClient,
}: scheduleTileEngineMotionCleanup.Props) => {
	for (const event of events) {
		for (const target of cleanupTargetsForEvent(event)) {
			const { groupId } = target.animation;
			const delayMs = tileEngineMotionCleanupDelayMs(target.animation);

			globalThis.setTimeout(() => {
				DebugTimeline.record({
					scope: "action-cache",
					event: "tile-engine-motion.cleanup",
					detail: {
						...target,
						animation: undefined,
						cleanupDelayMs: delayMs,
						groupId,
					},
				});

				if (target.kind === "board") {
					cleanupBoardMotion({
						queryClient,
						groupId,
						itemInstanceId: target.itemInstanceId,
					});
					return;
				}

				cleanupInventoryMotion({
					queryClient,
					groupId,
					slotIndex: target.slotIndex,
				});
			}, delayMs);
		}
	}
};
