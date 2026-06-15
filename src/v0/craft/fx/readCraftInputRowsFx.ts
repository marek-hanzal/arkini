import { Effect } from "effect";
import { dbFx } from "~/v0/database/fx/dbFx";
import { ItemInstanceRowSchema } from "~/v0/item-instance/type/ItemInstanceRowSchema";
import { defaultSaveGameId } from "~/v0/play/save";

export namespace readCraftInputRowsFx {
	export interface Props {
		ownerItemInstanceIds?: readonly string[];
	}
}

export const readCraftInputRowsFx = Effect.fn("readCraftInputRowsFx")(function* ({
	ownerItemInstanceIds,
}: readCraftInputRowsFx.Props = {}) {
	const rows = yield* dbFx((db) => {
		let query = db
			.selectFrom("itemInstance")
			.selectAll()
			.where("saveGameId", "=", defaultSaveGameId)
			.where("locationKind", "=", "craft-input")
			.orderBy("ownerItemInstanceId")
			.orderBy("itemDefinitionId");

		if (ownerItemInstanceIds?.length) {
			query = query.where("ownerItemInstanceId", "in", [
				...ownerItemInstanceIds,
			]);
		}

		return query.execute();
	});

	return rows.map((row) => ItemInstanceRowSchema.parse(row));
});
