import { Effect } from "effect";
import { dbFx } from "~/v0/database/fx/dbFx";
import { ItemInstanceRowSchema } from "~/item-instance/type/ItemInstanceRowSchema";
import { defaultSaveGameId } from "~/v0/play/save";

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
			.selectFrom("itemInstance")
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
