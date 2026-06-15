import { Effect } from "effect";
import { dbFx } from "~/v0/database/fx/dbFx";
import { DateServiceFx } from "~/v0/date/context/DateServiceFx";
import type { ItemId } from "~/v0/manifest/manifestId";
import { defaultSaveGameId } from "~/v0/play/save";
import { emptyInventoryStateJson } from "~/v0/inventory/logic/emptyInventoryStateJson";
import { activationInputStorageKey } from "../logic/activationInputStorageKey";

export namespace storeActivationInputFx {
	export interface Props {
		sourceItemInstanceId: string;
		ownerItemInstanceId: string;
		itemId: ItemId;
		quantity?: number;
	}
}

export const storeActivationInputFx = Effect.fn("storeActivationInputFx")(function* ({
	sourceItemInstanceId,
	ownerItemInstanceId,
	itemId,
	quantity = 1,
}: storeActivationInputFx.Props) {
	const date = yield* DateServiceFx;
	const updatedAt = date.timestamp();
	const existing = yield* dbFx((db) =>
		db
			.selectFrom("itemInstance")
			.selectAll()
			.where("locationKind", "=", "activation-input")
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
				id: activationInputStorageKey({
					ownerItemInstanceId,
					itemId,
				}),
				saveGameId: defaultSaveGameId,
				itemDefinitionId: itemId,
				quantity,
				locationKind: "activation-input",
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
