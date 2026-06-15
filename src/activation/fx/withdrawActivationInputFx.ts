import { Effect } from "effect";
import type { ItemId } from "~/manifest/manifestId";
import { spendActivationInputFx } from "./spendActivationInputFx";

export namespace withdrawActivationInputFx {
	export interface Props {
		ownerItemInstanceId: string;
		itemId: ItemId;
	}
}

export const withdrawActivationInputFx = Effect.fn("withdrawActivationInputFx")(function* ({
	ownerItemInstanceId,
	itemId,
}: withdrawActivationInputFx.Props) {
	yield* spendActivationInputFx({
		ownerItemInstanceId,
		itemId,
		quantity: 1,
	});
});
