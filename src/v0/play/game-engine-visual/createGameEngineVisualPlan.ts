import { cellKey } from "~/v0/board/cellKey";
import type { BoardView } from "~/v0/board/view/BoardViewSchema";
import type { InventoryView } from "~/v0/inventory/view/InventoryViewSchema";
import type { BoardTransientTile } from "~/v0/board/animation/BoardTransientTile";
import type { GameEvent } from "~/v0/game/engine/model/GameEventSchema";
import type { GameEngineVisualPlan } from "~/v0/play/game-engine-visual/GameEngineVisualPlan";
import type { TileEngineMotionRequest } from "~/v0/tile-engine";
import { GameVisualMotion } from "~/v0/play/game-engine-visual/GameVisualMotion";
import { gameVisualMotionSettlementDelayMs } from "~/v0/play/game-engine-visual/gameVisualMotionSettlementDelayMs";
import { toTileEngineEnterMotion } from "~/v0/play/game-engine-visual/toTileEngineEnterMotion";
import { toTileEngineExitMotion } from "~/v0/play/game-engine-visual/toTileEngineExitMotion";

export namespace createGameEngineVisualPlan {
	export interface Props {
		currentBoard: BoardView | undefined;
		currentInventory: InventoryView | undefined;
		events: readonly GameEvent[];
		previousBoard: BoardView | undefined;
	}
}

type CreatedEvent = Extract<
	GameEvent,
	{
		type: "item.created";
	}
>;
type ConsumedEvent = Extract<
	GameEvent,
	{
		type: "item.consumed";
	}
>;
type ReplacedEvent = Extract<
	GameEvent,
	{
		type: "item.replaced";
	}
>;

const createdCause = (reason: CreatedEvent["reason"]): GameVisualMotion["cause"] => {
	if (reason === "product-output" || reason === "producer-input-withdraw") return "producer";
	if (reason === "craft-input-withdraw") return "craft";
	if (reason === "stash-output") return "stash";
	return "inventory";
};

const createdGroupId = (event: CreatedEvent) =>
	`engine:${event.reason}:${event.originItemInstanceId ?? event.itemId}`;

const mergeSourceTileId = (event: ConsumedEvent) => {
	if (event.from.kind === "board") return event.from.itemInstanceId;

	return `inventory:${event.from.slotIndex}:${event.itemId}`;
};

const appendCreatedVisuals = ({
	currentBoard,
	currentInventory,
	event,
	plan,
	sequenceIndex,
}: {
	currentBoard: BoardView | undefined;
	currentInventory: InventoryView | undefined;
	event: CreatedEvent;
	plan: MutableGameEngineVisualPlan;
	sequenceIndex: number;
}) => {
	if (event.to.kind === "board") {
		if (!currentBoard?.byId[event.to.itemInstanceId]) return;

		const motion = GameVisualMotion.sequenceFadeIn({
			cause: createdCause(event.reason),
			groupId: createdGroupId(event),
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

const appendMergeVisuals = ({
	currentBoard,
	previousBoard,
	replaced,
	source,
	plan,
}: {
	currentBoard: BoardView | undefined;
	previousBoard: BoardView | undefined;
	replaced: ReplacedEvent;
	source: ConsumedEvent;
	plan: MutableGameEngineVisualPlan;
}) => {
	const previousTarget = previousBoard?.byId[replaced.itemInstanceId];
	const currentTarget = currentBoard?.byId[replaced.itemInstanceId];
	if (!previousTarget || !currentTarget) return;

	const previousSource =
		source.from.kind === "board" ? previousBoard?.byId[source.from.itemInstanceId] : undefined;
	if (previousTarget.itemId === replaced.toItemId && !previousSource) return;

	const motion = GameVisualMotion.merge({
		cause: "merge",
		groupId: `engine:merge:${mergeSourceTileId(source)}:${replaced.itemInstanceId}`,
	});
	const cleanupDelayMs = gameVisualMotionSettlementDelayMs(motion);
	const exit = toTileEngineExitMotion(motion);
	const transientTiles: BoardTransientTile[] = [
		...(previousSource
			? [
					{
						groupId: motion.groupId,
						id: `transient:merge-out:${motion.groupId}:source:${previousSource.id}`,
						itemId: source.itemId as BoardTransientTile["itemId"],
						slotId: cellKey(previousTarget.x, previousTarget.y),
					},
				]
			: []),
		{
			groupId: motion.groupId,
			id: `transient:merge-out:${motion.groupId}:target:${previousTarget.id}`,
			itemId: replaced.fromItemId as BoardTransientTile["itemId"],
			slotId: cellKey(previousTarget.x, previousTarget.y),
		},
	];

	plan.boardTransientTilePlans.push(
		...transientTiles.map((tile) => ({
			cleanupDelayMs,
			groupId: motion.groupId,
			request: {
				cleanupDelayMs,
				exit,
				tileId: tile.id,
			},
			tile,
		})),
	);
	plan.boardEnterRequests.push({
		cleanupDelayMs,
		enter: toTileEngineEnterMotion(motion),
		tileId: currentTarget.id,
	});
};

const appendReplaceVisuals = ({
	currentBoard,
	previousBoard,
	event,
	plan,
}: {
	currentBoard: BoardView | undefined;
	previousBoard: BoardView | undefined;
	event: ReplacedEvent;
	plan: MutableGameEngineVisualPlan;
}) => {
	if (event.reason !== "craft-result") return;

	const previousTarget = previousBoard?.byId[event.itemInstanceId];
	const currentTarget = currentBoard?.byId[event.itemInstanceId];
	if (!previousTarget || !currentTarget) return;

	const motion = GameVisualMotion.replace({
		cause: "craft",
		groupId: `engine:${event.reason}:${event.itemInstanceId}`,
	});
	const cleanupDelayMs = gameVisualMotionSettlementDelayMs(motion);
	const tile: BoardTransientTile = {
		groupId: motion.groupId,
		id: `transient:replace-out:${motion.groupId}:target:${previousTarget.id}`,
		itemId: event.fromItemId as BoardTransientTile["itemId"],
		slotId: cellKey(previousTarget.x, previousTarget.y),
	};

	plan.boardTransientTilePlans.push({
		cleanupDelayMs,
		groupId: motion.groupId,
		request: {
			cleanupDelayMs,
			exit: toTileEngineExitMotion(motion),
			tileId: tile.id,
		},
		tile,
	});
	plan.boardEnterRequests.push({
		cleanupDelayMs,
		enter: toTileEngineEnterMotion(motion),
		tileId: currentTarget.id,
	});
};

interface MutableGameEngineVisualPlan {
	boardEnterRequests: TileEngineMotionRequest[];
	boardTransientTilePlans: GameEngineVisualPlan["boardTransientTilePlans"] extends readonly (infer T)[]
		? T[]
		: never;
	ignoredEventTypes: string[];
	inventoryEnterRequests: TileEngineMotionRequest[];
}

export const createGameEngineVisualPlan = ({
	currentBoard,
	currentInventory,
	events,
	previousBoard,
}: createGameEngineVisualPlan.Props): GameEngineVisualPlan => {
	const plan: MutableGameEngineVisualPlan = {
		boardEnterRequests: [],
		boardTransientTilePlans: [],
		ignoredEventTypes: [],
		inventoryEnterRequests: [],
	};
	const skipped = new Set<number>();
	let createdSequenceIndex = 0;

	for (const [index, event] of events.entries()) {
		if (skipped.has(index)) continue;

		switch (event.type) {
			case "item.created":
				appendCreatedVisuals({
					currentBoard,
					currentInventory,
					event,
					plan,
					sequenceIndex: createdSequenceIndex,
				});
				createdSequenceIndex += 1;
				break;

			case "item.consumed": {
				if (event.reason === "merge-source") {
					const replacementIndex = events.findIndex(
						(candidate, candidateIndex) =>
							candidateIndex > index &&
							!skipped.has(candidateIndex) &&
							candidate.type === "item.replaced" &&
							candidate.reason === "merge-result",
					);
					const replacement = events[replacementIndex];
					if (replacement?.type === "item.replaced") {
						skipped.add(replacementIndex);
						appendMergeVisuals({
							currentBoard,
							plan,
							previousBoard,
							replaced: replacement,
							source: event,
						});
						break;
					}
				}

				plan.ignoredEventTypes.push(event.type);
				break;
			}

			case "item.replaced":
				appendReplaceVisuals({
					currentBoard,
					event,
					plan,
					previousBoard,
				});
				break;

			case "craft.completed":
			case "craft.started":
			case "craft_input.stored":
			case "craft_input.withdrawn":
			case "item.removed":
			case "item.spawn.blocked":
			case "producer.product_line.enabled_changed":
			case "producer_input.stored":
			case "producer_input.withdrawn":
			case "product.blocked":
			case "product.completed":
			case "product.started":
			case "stash.depleted":
			case "stash.opened":
			case "stored_requirement.stored":
			case "stored_requirement.withdrawn":
			case "upgrade.completed":
			case "upgrade.started":
				plan.ignoredEventTypes.push(event.type);
				break;

			default: {
				const exhaustive: never = event;
				return exhaustive;
			}
		}
	}
	return plan;
};
