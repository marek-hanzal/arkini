import { useMemo } from "react";
import type { GameConfig } from "~/v0/game/config/GameConfigSchema";
import type { GameActionItemRef } from "~/v0/game/engine/model/GameActionItemRefSchema";
import type { GameSave, GameSaveBoardItem } from "~/v0/game/engine/model/GameSaveSchema";
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

const productLineEnabled = ({
	productId,
	save,
	targetItemInstanceId,
}: {
	productId: string;
	save: GameSave;
	targetItemInstanceId: string;
}) => !(save.producerLines[targetItemInstanceId]?.disabledProductIds ?? []).includes(productId);

const storedRequirementAcceptsItem = ({
	config,
	itemId,
	save,
	target,
}: {
	config: GameConfig;
	itemId: string;
	save: GameSave;
	target: GameSaveBoardItem;
}) => {
	const targetItem = config.items[target.itemId];
	if (!targetItem) return false;

	const productRequirements = targetItem.producerId
		? (config.producers[targetItem.producerId]?.productIds ?? []).flatMap((productId) =>
				productLineEnabled({
					productId,
					save,
					targetItemInstanceId: target.id,
				})
					? (config.products[productId]?.requirements ?? [])
					: [],
			)
		: [];
	const requirements = [
		...(targetItem.producerId
			? (config.producers[targetItem.producerId]?.requirements ?? [])
			: []),
		...productRequirements,
		...(targetItem.stashId ? (config.stashes[targetItem.stashId]?.requirements ?? []) : []),
	];

	return requirements.some(
		(requirement) => requirement.type === "stored" && requirement.itemId === itemId,
	);
};

const productIdForInput = ({
	config,
	save,
	sourceItemId,
	target,
}: {
	config: GameConfig;
	save: GameSave;
	sourceItemId: string;
	target: GameSaveBoardItem;
}) => {
	const targetItem = config.items[target.itemId];
	const producerId = targetItem?.producerId;
	const producer = producerId ? config.producers[producerId] : undefined;
	if (!producer) return undefined;

	return producer.productIds.find(
		(productId) =>
			productLineEnabled({
				productId,
				save,
				targetItemInstanceId: target.id,
			}) && config.products[productId]?.inputs.some((input) => input.itemId === sourceItemId),
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

const dispatchApplyItemToBoardItem = ({
	config,
	save,
	sourceItemId,
	sourceRef,
	store,
	target,
}: {
	config: GameConfig;
	save: GameSave;
	sourceItemId: string;
	sourceRef: GameActionItemRef;
	store: ReturnType<typeof useGameRuntimeStore>;
	target: GameSaveBoardItem;
}) => {
	if (
		hasMergeRule({
			config,
			sourceItemId,
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
	if (recipeId && recipe?.inputs.some((input) => input.itemId === sourceItemId)) {
		return store.dispatch({
			action: {
				inputRefs: [
					sourceRef,
				],
				recipeId,
				requirementRefs: [],
				targetItemInstanceId: target.id,
				type: "craft.start",
			},
		});
	}

	const productId = productIdForInput({
		config,
		save,
		sourceItemId,
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
			sourceItemId,
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
			itemId: sourceItemId,
			save,
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
};

export const useGameRuntimeDropActions = (): DropActions => {
	const store = useGameRuntimeStore();

	return useMemo(
		() => ({
			applyBoardItemToBoardItem(input) {
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

				return dispatchApplyItemToBoardItem({
					config,
					save,
					sourceItemId: source.itemId,
					sourceRef: {
						kind: "board",
						itemInstanceId: source.id,
					},
					store,
					target,
				});
			},
			applyInventoryItemToBoardItem(input) {
				const snapshot = store.getSnapshot();
				const { config, save } = snapshot.runtime;
				const source = save.inventory.slots[input.sourceSlotIndex];
				const target = save.board.items[input.targetBoardItemId];
				if (!source || !target) {
					return store.dispatch({
						action: {
							sourceRef: {
								kind: "inventory",
								quantity: 1,
								slotIndex: input.sourceSlotIndex,
							},
							targetItemInstanceId: input.targetBoardItemId,
							type: "item.merge",
						},
					});
				}

				return dispatchApplyItemToBoardItem({
					config,
					save,
					sourceItemId: source.itemId,
					sourceRef: {
						kind: "inventory",
						quantity: 1,
						slotIndex: input.sourceSlotIndex,
					},
					store,
					target,
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
