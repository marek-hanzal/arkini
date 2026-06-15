import { Effect } from "effect";
import { dbFx } from "~/database/fx/dbFx";
import { table } from "~/database/local/tables";
import { ItemInstanceRowSchema } from "~/item-instance/type/ItemInstanceRowSchema";
import { defaultSaveGameId } from "~/play/logic/save";

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
			.selectFrom(table.itemInstance)
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
