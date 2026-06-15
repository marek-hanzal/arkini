import type { QueryClient } from "@tanstack/react-query";
import { match } from "ts-pattern";
import { rebuildBoardView } from "~/v0/board/view/rebuildBoardView";
import type { BoardView } from "~/v0/board/view/BoardViewSchema";
import type { BoardViewItem } from "~/v0/board/view/BoardViewItemSchema";
import { patchBoardViewCache } from "~/v0/board/cache/patchBoardViewCache";
import { patchInventorySlotCache } from "~/v0/inventory/cache/patchInventorySlotCache";
import { patchInventoryViewCache } from "~/v0/inventory/cache/patchInventoryViewCache";
import type { InventoryView } from "~/v0/inventory/view/InventoryViewSchema";
import type { ActionResult } from "~/v0/play/action/ActionResult";
import type { ActionVisualEventSchema } from "~/v0/play/action/ActionVisualEventSchema";

export namespace applyActionResultCachePatch {
	export interface Props {
		queryClient: QueryClient;
		result: ActionResult.Type;
	}
}

const emptyStateJson = "{}";

const createBoardItem = (
	event: Extract<
		ActionVisualEventSchema.Type,
		{
			type: "item.spawned";
		}
	>,
): BoardViewItem | null => {
	if (event.to.kind !== "board" || !event.itemInstanceId) return null;

	return {
		id: event.itemInstanceId,
		itemId: event.itemId,
		x: event.to.x,
		y: event.to.y,
		state: {},
		motion: {
			enter: {},
		},
	};
};

const upsertBoardItem = (board: BoardView, item: BoardViewItem) =>
	rebuildBoardView([
		...board.items.filter((entry) => entry.id !== item.id),
		item,
	]);

const removeBoardItem = (board: BoardView, boardItemId: string) =>
	rebuildBoardView(board.items.filter((item) => item.id !== boardItemId));

const patchBoardEvent = (board: BoardView, event: ActionVisualEventSchema.Type): BoardView =>
	match(event)
		.with(
			{
				type: "item.spawned",
			},
			(spawned) => {
				const item = createBoardItem(spawned);
				if (!item || board.byId[item.id]) return board;

				return rebuildBoardView([
					...board.items.filter(
						(entry) =>
							!(
								entry.id.startsWith("cache:") &&
								entry.itemId === item.itemId &&
								entry.x === item.x &&
								entry.y === item.y
							),
					),
					item,
				]);
			},
		)
		.with(
			{
				type: "item.moved",
			},
			(moved) => {
				if (moved.from.kind === "board" && moved.to.kind !== "board") {
					return removeBoardItem(board, moved.itemInstanceId);
				}
				if (moved.to.kind !== "board") return board;

				const existing = board.byId[moved.itemInstanceId];
				return upsertBoardItem(board, {
					...(existing ?? {
						id: moved.itemInstanceId,
						itemId: moved.itemId,
						state: {},
					}),
					x: moved.to.x,
					y: moved.to.y,
				});
			},
		)
		.with(
			{
				type: "item.swapped",
			},
			(swapped) => {
				const source = board.byId[swapped.sourceItemInstanceId];
				const target = board.byId[swapped.targetItemInstanceId];
				if (!source || !target) return board;
				return rebuildBoardView(
					board.items.map((item) => {
						if (item.id === source.id && swapped.sourceTo.kind === "board") {
							return {
								...item,
								x: swapped.sourceTo.x,
								y: swapped.sourceTo.y,
							};
						}
						if (item.id === target.id && swapped.targetTo.kind === "board") {
							return {
								...item,
								x: swapped.targetTo.x,
								y: swapped.targetTo.y,
							};
						}
						return item;
					}),
				);
			},
		)
		.with(
			{
				type: "item.merged",
			},
			(merged) => {
				const target = board.byId[merged.targetItemInstanceId];
				if (!target) return board;
				const nextItems = board.items.flatMap((item) => {
					if (merged.consumeSource && item.id === merged.sourceItemInstanceId) return [];
					if (item.id !== target.id)
						return [
							item,
						];
					return [
						{
							...item,
							itemId: merged.resultItemId,
							state: {},
							activation: undefined,
							craft: undefined,
						},
					];
				});
				return rebuildBoardView(nextItems);
			},
		)
		.with(
			{
				type: "item.fed",
			},
			(fed) => removeBoardItem(board, fed.sourceItemInstanceId),
		)
		.with(
			{
				type: "item.consumed",
			},
			(consumed) => removeBoardItem(board, consumed.itemInstanceId),
		)
		.with(
			{
				type: "activation.activated",
			},
			(activated) => {
				const source = board.byId[activated.itemInstanceId];
				const activation = source?.activation;
				if (!source || !activation) return board;

				const cooldownUntilMs = activation.cooldownMs
					? Date.now() + activation.cooldownMs
					: activation.cooldownUntilMs;
				const remainingCharges =
					activation.kind === "stash"
						? activated.mode === "exhaust"
							? 0
							: Math.max(0, (activation.remainingCharges ?? 1) - 1)
						: activation.remainingCharges;

				return rebuildBoardView(
					board.items.map((item) =>
						item.id === source.id
							? {
									...item,
									activation: {
										...activation,
										cooldownUntilMs,
										remainingCharges,
									},
								}
							: item,
					),
				);
			},
		)
		.with(
			{
				type: "activation.depleted",
			},
			(depleted) =>
				match(depleted.depletion)
					.with(
						{
							kind: "remove",
						},
						() => removeBoardItem(board, depleted.itemInstanceId),
					)
					.with(
						{
							kind: "replace",
						},
						(replacement) => {
							const source = board.byId[depleted.itemInstanceId];
							if (!source) return board;
							return rebuildBoardView(
								board.items.map((item) =>
									item.id === source.id
										? {
												...item,
												itemId: replacement.itemId,
												state: {},
												activation: undefined,
												craft: undefined,
											}
										: item,
								),
							);
						},
					)
					.exhaustive(),
		)
		.with(
			{
				type: "craft.started",
			},
			(started) => {
				const target = board.byId[started.itemInstanceId];
				const craft = target?.craft;
				if (!target || !craft) return board;
				const startedAtMs = Date.now();
				return rebuildBoardView(
					board.items.map((item) =>
						item.id === target.id
							? {
									...item,
									craft: {
										...craft,
										phase:
											started.readyAtMs && started.readyAtMs <= startedAtMs
												? "ready"
												: "waiting",
										complete: Boolean(
											started.readyAtMs && started.readyAtMs <= startedAtMs,
										),
										progress: 0,
										timeProgress: 0,
										startedAtMs,
										readyAtMs: started.readyAtMs,
										remainingMs: started.readyAtMs
											? Math.max(0, started.readyAtMs - startedAtMs)
											: undefined,
										canAcceptInputs: false,
										acceptedInputItemIds: [],
									},
								}
							: item,
					),
				);
			},
		)
		.with(
			{
				type: "craft.claimed",
			},
			(claimed) => {
				const target = board.byId[claimed.itemInstanceId];
				if (!target) return board;
				return rebuildBoardView(
					board.items.map((item) =>
						item.id === target.id
							? {
									...item,
									itemId: claimed.resultItemId,
									state: {},
									activation: undefined,
									craft: undefined,
								}
							: item,
					),
				);
			},
		)
		.otherwise(() => board);

const patchInventoryEvent = (
	inventory: InventoryView,
	event: ActionVisualEventSchema.Type,
): InventoryView =>
	match(event)
		.with(
			{
				type: "item.spawned",
			},
			(spawned) => {
				const target = spawned.to;
				if (target.kind !== "inventory") return inventory;
				return patchInventorySlotCache({
					inventory,
					slotIndex: target.slotIndex,
					patch: (slot) => ({
						...slot,
						stack:
							slot.stack?.itemId === spawned.itemId
								? {
										...slot.stack,
										quantity: slot.stack.quantity + 1,
									}
								: {
										id:
											spawned.itemInstanceId ??
											`cache:${spawned.itemId}:${target.slotIndex}`,
										itemId: spawned.itemId,
										quantity: 1,
										state: {},
										stateJson: emptyStateJson,
										stateful: false,
									},
					}),
				});
			},
		)
		.with(
			{
				type: "inventory.stacked",
			},
			(stacked) =>
				patchInventoryViewCacheValue(inventory, stacked.targetItemInstanceId, (slot) => ({
					...slot,
					stack: slot.stack
						? {
								...slot.stack,
								quantity: stacked.quantity,
							}
						: slot.stack,
				})),
		)
		.otherwise(() => inventory);

const patchInventoryViewCacheValue = (
	inventory: InventoryView,
	stackId: string,
	patch: (slot: InventoryView["slots"][number]) => InventoryView["slots"][number],
) => {
	const slot = inventory.slots.find((entry) => entry.stack?.id === stackId);
	if (!slot) return inventory;
	return patchInventorySlotCache({
		inventory,
		slotIndex: slot.slotIndex,
		patch,
	});
};

const spawnSequenceDelayMs = 135;

const shouldSequenceSpawnEvents = (events: readonly ActionVisualEventSchema.Type[]) =>
	events.some((event) => event.type === "activation.activated" && event.mode === "exhaust");

const applyVisualEvents = ({
	events,
	queryClient,
}: {
	events: readonly ActionVisualEventSchema.Type[];
	queryClient: QueryClient;
}) => {
	patchBoardViewCache({
		queryClient,
		patch: (board) => events.reduce((current, event) => patchBoardEvent(current, event), board),
	});
	patchInventoryViewCache({
		queryClient,
		patch: (inventory) =>
			events.reduce((current, event) => patchInventoryEvent(current, event), inventory),
	});
};

export const applyActionResultCachePatch = ({
	queryClient,
	result,
}: applyActionResultCachePatch.Props) => {
	if (!shouldSequenceSpawnEvents(result.visualEvents)) {
		applyVisualEvents({
			queryClient,
			events: result.visualEvents,
		});
		return;
	}

	const spawnedEvents = result.visualEvents.filter((event) => event.type === "item.spawned");
	const immediateEvents = result.visualEvents.filter((event) => event.type !== "item.spawned");
	applyVisualEvents({
		queryClient,
		events: immediateEvents,
	});

	spawnedEvents.forEach((event, index) => {
		window.setTimeout(() => {
			applyVisualEvents({
				queryClient,
				events: [
					event,
				],
			});
		}, index * spawnSequenceDelayMs);
	});
};
