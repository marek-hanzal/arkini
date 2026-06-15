import { Effect } from "effect";
import { dbFx } from "~/v0/database/fx/dbFx";
import { DateServiceFx } from "~/v0/date/context/DateServiceFx";
import { emptyInventoryStateJson } from "~/v0/inventory/logic/emptyInventoryStateJson";
import type { ItemId } from "~/v0/manifest/manifestId";
import { defaultSaveGameId } from "~/v0/play/save";
import { craftInputStorageKey } from "~/v0/craft/logic/craftInputStorageKey";

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
			.selectFrom("itemInstance")
			.selectAll()
			.where("locationKind", "=", "craft-input")
			.where("ownerItemInstanceId", "=", ownerItemInstanceId)
			.where("itemDefinitionId", "=", itemId)
			.executeTakeFirst(),
	);

	if (existing) {
		yield* dbFx(async (db) => {
			await db.deleteFrom("itemInstance").where("id", "=", sourceItemInstanceId).execute();
			await db
				.updateTable("itemInstance")
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
			.updateTable("itemInstance")
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
