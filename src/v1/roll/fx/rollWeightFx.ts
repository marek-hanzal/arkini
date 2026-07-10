import { Effect } from "effect";

import type { RollResult } from "~/v1/roll/RollResult";
import type { RollWeightSchema } from "~/v1/roll/schema/RollWeightSchema";
import { rollQuantityFx } from "~/v1/quantity/fx/rollQuantityFx";
import { selectDropWeightFx } from "./selectDropWeightFx";

export namespace rollWeightFx {
	export interface Props {
		roll: RollWeightSchema.Type;
	}
}

/** Composes quantity resolution with repeated weighted drop selection. */
export const rollWeightFx = Effect.fn("rollWeightFx")(function* ({ roll }: rollWeightFx.Props) {
	const quantity = yield* rollQuantityFx({
		quantity: roll.quantity,
	});
	const drop: RollResult["drop"][number][] = [];

	for (let index = 0; index < quantity; index += 1) {
		const selected = yield* selectDropWeightFx({
			drop: roll.drop,
		});
		drop.push(...selected.drop);
	}

	return {
		drop,
	} satisfies RollResult;
});
