import type { ItemInstanceRowSchema } from "~/v0/item-instance/type/ItemInstanceRowSchema";
import { BoardItemRowSchema } from "~/v0/board/schema/BoardItemRowSchema";

export const toBoardItemRow = (row: ItemInstanceRowSchema.Type) => {
	if (row.locationKind !== "board" || row.boardX === null || row.boardY === null) {
		throw new Error(`Item instance ${row.id} is not a board item.`);
	}

	return BoardItemRowSchema.parse({
		id: row.id,
		saveGameId: row.saveGameId,
		itemDefinitionId: row.itemDefinitionId,
		x: row.boardX,
		y: row.boardY,
		stateJson: row.stateJson,
		createdAt: row.createdAt,
		updatedAt: row.updatedAt,
	});
};
