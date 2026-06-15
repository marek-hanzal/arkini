import { Effect } from "effect";
import { dbFx } from "~/database/fx/dbFx";
import { table } from "~/database/local/tables";
import { DateServiceFx } from "~/date/context/DateServiceFx";
import { emptyInventoryStateJson } from "~/inventory/logic/emptyInventoryStateJson";
import type { ItemId } from "~/manifest/manifestId";
import { defaultSaveGameId } from "~/play/logic/save";
import { craftInputStorageKey } from "~/craft/logic/craftInputStorageKey";

export namespace storeCraftInputFx {
	export interface Props {
		sourceItemInstanceId: string;
		ownerItemInstanceId: string;
		itemId: ItemId;
		quantity?: number;
	}
}

export const storeCraftInputFx = Effect.fn("storeCraftInputFx")(function* ({
	sourceItemInstanceId,
	ownerItemInstanceId,
	itemId,
	quantity = 1,
}: storeCraftInputFx.Props) {
	const date = yield* DateServiceFx;
	const updatedAt = date.timestamp();
	const existing = yield* dbFx((db) =>
		db
			.selectFrom(table.itemInstance)
			.selectAll()
			.where("locationKind", "=", "craft-input")
			.where("ownerItemInstanceId", "=", ownerItemInstanceId)
			.where("itemDefinitionId", "=", itemId)
			.executeTakeFirst(),
	);

	if (existing) {
		yield* dbFx(async (db) => {
			await db
				.deleteFrom(table.itemInstance)
				.where("id", "=", sourceItemInstanceId)
				.execute();
			await db
				.updateTable(table.itemInstance)
				.set({
					quantity: existing.quantity + quantity,
					updatedAt,
				})
				.where("id", "=", existing.id)
				.execute();
		});
		return;
	}

	yield* dbFx((db) =>
		db
			.updateTable(table.itemInstance)
			.set({
				id: craftInputStorageKey({
					ownerItemInstanceId,
					itemId,
				}),
				saveGameId: defaultSaveGameId,
				itemDefinitionId: itemId,
				quantity,
				locationKind: "craft-input",
				boardX: null,
				boardY: null,
				inventorySlotIndex: null,
				ownerItemInstanceId,
				inputItemDefinitionId: itemId,
				stateJson: emptyInventoryStateJson,
				updatedAt,
			})
			.where("id", "=", sourceItemInstanceId)
			.execute(),
	);
});
