import { Effect } from "effect";
import { dbFx } from "~/database/fx/dbFx";
import { table } from "~/database/local/tables";

export namespace deleteCraftInputsFx {
	export interface Props {
		ownerItemInstanceId: string;
	}
}

export const deleteCraftInputsFx = Effect.fn("deleteCraftInputsFx")(function* ({
	ownerItemInstanceId,
}: deleteCraftInputsFx.Props) {
	yield* dbFx((db) =>
		db
			.deleteFrom(table.itemInstance)
			.where("locationKind", "=", "craft-input")
			.where("ownerItemInstanceId", "=", ownerItemInstanceId)
			.execute(),
	);
});
