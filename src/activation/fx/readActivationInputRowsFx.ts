import { Effect } from "effect";
import { dbFx } from "~/database/fx/dbFx";
import { table } from "~/database/local/tables";
import { ItemInstanceRowSchema } from "~/item-instance/type/ItemInstanceRowSchema";
import { defaultSaveGameId } from "~/play/logic/save";

export namespace readActivationInputRowsFx {
	export interface Props {
		ownerItemInstanceIds?: readonly string[];
	}
}

export const readActivationInputRowsFx = Effect.fn("readActivationInputRowsFx")(function* ({
	ownerItemInstanceIds,
}: readActivationInputRowsFx.Props = {}) {
	const rows = yield* dbFx((db) => {
		let query = db
			.selectFrom(table.itemInstance)
			.selectAll()
			.where("saveGameId", "=", defaultSaveGameId)
			.where("locationKind", "=", "activation-input")
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
