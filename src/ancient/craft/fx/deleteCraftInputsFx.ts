import { Effect } from "effect";
import { dbFx } from "~/database/fx/dbFx";

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
			.deleteFrom("itemInstance")
			.where("locationKind", "=", "craft-input")
			.where("ownerItemInstanceId", "=", ownerItemInstanceId)
			.execute(),
	);
});
