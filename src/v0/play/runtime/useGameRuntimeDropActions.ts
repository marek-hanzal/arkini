import { useMemo } from "react";
import type { GameConfig } from "~/v0/game/config/GameConfigSchema";
import type { GameActionItemRef } from "~/v0/game/engine/model/GameActionItemRefSchema";
import type { GameSaveBoardItem } from "~/v0/game/engine/model/GameSaveSchema";
import type { DropActions } from "~/v0/play/drop/DropActions";
import { useGameRuntimeStore } from "~/v0/play/runtime/GameRuntimeContext";

const hasMergeRule = ({
	config,
	sourceItemId,
	targetItemId,
}: {
	config: GameConfig;
	sourceItemId: string;
	targetItemId: string;
}) => {
	const sourceItem = config.items[sourceItemId];

	return Boolean(
		sourceItem?.mergeIds
			?.map((mergeId) => config.merge[mergeId])
			.find((rule) => rule?.withItemId === targetItemId),
	);
};

const storedRequirementAcceptsItem = ({
	config,
	target,
	itemId,
}: {
	config: GameConfig;
	target: GameSaveBoardItem;
	itemId: string;
}) => {
	const targetItem = config.items[target.itemId];
	if (!targetItem) return false;

	const requirements = [
		...(targetItem.producerId
			? (config.producers[targetItem.producerId]?.requirements ?? [])
			: []),
		...(targetItem.producerId
			? (config.producers[targetItem.producerId]?.productIds ?? []).flatMap(
					(productId) => config.products[productId]?.requirements ?? [],
				)
			: []),
		...(targetItem.stashId ? (config.stashes[targetItem.stashId]?.requirements ?? []) : []),
	];

	return requirements.some(
		(requirement) => requirement.type === "stored" && requirement.itemId === itemId,
	);
};

const productIdForInput = ({
	config,
	sourceItemId,
	target,
}: {
	config: GameConfig;
	sourceItemId: string;
	target: GameSaveBoardItem;
}) => {
	const targetItem = config.items[target.itemId];
	const producerId = targetItem?.producerId;
	const producer = producerId ? config.producers[producerId] : undefined;
	if (!producer) return undefined;

	return producer.productIds.find((productId) =>
		config.products[productId]?.inputs.some((input) => input.itemId === sourceItemId),
	);
};

const stashAcceptsInput = ({
	config,
	sourceItemId,
	target,
}: {
	config: GameConfig;
	sourceItemId: string;
	target: GameSaveBoardItem;
}) => {
	const targetItem = config.items[target.itemId];
	const stashId = targetItem?.stashId;
	const stash = stashId ? config.stashes[stashId] : undefined;

	return Boolean(stash?.inputs.some((input) => input.itemId === sourceItemId));
};

export const useGameRuntimeDropActions = (): DropActions => {
	const store = useGameRuntimeStore();

	return useMemo(
		() => ({
			mergeBoardItems(input) {
				const snapshot = store.getSnapshot();
				const { config, save } = snapshot.runtime;
				const source = save.board.items[input.sourceBoardItemId];
				const target = save.board.items[input.targetBoardItemId];
				if (!source || !target) {
					return store.dispatch({
						action: {
							sourceRef: {
								kind: "board",
								itemInstanceId: input.sourceBoardItemId,
							},
							targetItemInstanceId: input.targetBoardItemId,
							type: "item.merge",
						},
					});
				}

				const sourceRef: GameActionItemRef = {
					kind: "board",
					itemInstanceId: source.id,
				};

				if (
					hasMergeRule({
						config,
						sourceItemId: source.itemId,
						targetItemId: target.itemId,
					})
				) {
					return store.dispatch({
						action: {
							sourceRef,
							targetItemInstanceId: target.id,
							type: "item.merge",
						},
					});
				}

				const targetItem = config.items[target.itemId];
				const recipeId = targetItem?.craftRecipeId;
				const recipe = recipeId ? config.craftRecipes[recipeId] : undefined;
				if (recipeId && recipe?.inputs.some((input) => input.itemId === source.itemId)) {
					return store.dispatch({
						action: {
							inputRefs: [
								sourceRef,
							],
							recipeId,
							requirementRefs: [],
							type: "craft.start",
						},
					});
				}

				const productId = productIdForInput({
					config,
					sourceItemId: source.itemId,
					target,
				});
				if (productId) {
					return store.dispatch({
						action: {
							inputRefs: [
								sourceRef,
							],
							producerItemInstanceId: target.id,
							productId,
							type: "producer.product.start",
						},
					});
				}

				if (
					stashAcceptsInput({
						config,
						sourceItemId: source.itemId,
						target,
					})
				) {
					return store.dispatch({
						action: {
							inputRefs: [
								sourceRef,
							],
							stashItemInstanceId: target.id,
							type: "stash.open",
						},
					});
				}

				if (
					storedRequirementAcceptsItem({
						config,
						itemId: source.itemId,
						target,
					})
				) {
					return store.dispatch({
						action: {
							inputRef: sourceRef,
							targetItemInstanceId: target.id,
							type: "stored_requirement.store",
						},
					});
				}

				return store.dispatch({
					action: {
						sourceRef,
						targetItemInstanceId: target.id,
						type: "item.merge",
					},
				});
			},
			moveBoardItem(input) {
				return store.dispatch({
					action: {
						boardItemId: input.boardItemId,
						type: "board.item.move",
						x: input.x,
						y: input.y,
					},
				});
			},
			placeInventoryItem(input) {
				return store.dispatch({
					action: {
						slotIndex: input.slotIndex,
						type: "inventory.item.place",
						x: input.x,
						y: input.y,
					},
				});
			},
			stashBoardItem(input) {
				return store.dispatch({
					action: {
						boardItemId: input.boardItemId,
						type: "board.item.stash",
					},
				});
			},
			swapBoardItems(input) {
				return store.dispatch({
					action: {
						sourceBoardItemId: input.sourceBoardItemId,
						targetBoardItemId: input.targetBoardItemId,
						type: "board.items.swap",
					},
				});
			},
			swapInventorySlots(input) {
				return store.dispatch({
					action: {
						sourceSlotIndex: input.sourceSlotIndex,
						targetSlotIndex: input.targetSlotIndex,
						type: "inventory.slots.swap",
					},
				});
			},
		}),
		[
			store,
		],
	);
};
