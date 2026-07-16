import { match } from "ts-pattern";
import type { GameConfig } from "~/config/GameConfigTypes";
import type {
	GameSaveInventoryInstance,
	GameSaveInventoryStack,
} from "~/engine/model/GameSaveShapeSchema";
import {
	addSaveIssue,
	type GameSaveValidationContext,
} from "~/engine/model/GameSaveConfigValidationContext";

const validateSaveInventoryInstanceSlot = ({
	ctx,
	inventoryInstanceIds,
	save,
	slot,
	slotIndex,
}: Pick<GameSaveValidationContext, "ctx" | "save"> & {
	inventoryInstanceIds: Set<string>;
	slot: GameSaveInventoryInstance;
	slotIndex: number;
}) => {
	if (save.board.items[slot.id]) {
		addSaveIssue(
			ctx,
			[
				"inventory",
				"slots",
				slotIndex,
				"id",
			],
			`Inventory instance id "${slot.id}" already exists on board.`,
		);
	}

	if (inventoryInstanceIds.has(slot.id)) {
		addSaveIssue(
			ctx,
			[
				"inventory",
				"slots",
				slotIndex,
				"id",
			],
			`Duplicate inventory instance id "${slot.id}".`,
		);
		return;
	}

	inventoryInstanceIds.add(slot.id);
};

const validateSaveInventoryStackSlot = ({
	ctx,
	item,
	slot,
	slotIndex,
}: Pick<GameSaveValidationContext, "ctx"> & {
	item: GameConfig["items"][string];
	slot: GameSaveInventoryStack;
	slotIndex: number;
}) => {
	if (slot.quantity <= item.maxStackSize) return;

	addSaveIssue(
		ctx,
		[
			"inventory",
			"slots",
			slotIndex,
			"quantity",
		],
		`Quantity must be <= item maxStackSize (${item.maxStackSize}).`,
	);
};

export const validateSaveInventorySlots = ({ config, ctx, save }: GameSaveValidationContext) => {
	const inventoryInstanceIds = new Set<string>();
	for (const [slotIndex, slot] of save.inventory.slots.entries()) {
		if (!slot) continue;

		const item = config.items[slot.itemId];
		if (!item) {
			addSaveIssue(
				ctx,
				[
					"inventory",
					"slots",
					slotIndex,
					"itemId",
				],
				`Missing item "${slot.itemId}".`,
			);
			continue;
		}

		if (item.storage === "board") {
			addSaveIssue(
				ctx,
				[
					"inventory",
					"slots",
					slotIndex,
					"itemId",
				],
				`Item "${slot.itemId}" storage policy forbids inventory location.`,
			);
		}

		match(slot)
			.with(
				{
					kind: "instance",
				},
				(instanceSlot) =>
					validateSaveInventoryInstanceSlot({
						ctx,
						inventoryInstanceIds,
						save,
						slot: instanceSlot,
						slotIndex,
					}),
			)
			.otherwise((stackSlot) =>
				validateSaveInventoryStackSlot({
					ctx,
					item,
					slot: stackSlot,
					slotIndex,
				}),
			);
	}
};
