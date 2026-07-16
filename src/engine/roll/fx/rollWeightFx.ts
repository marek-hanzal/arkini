import { Effect } from "effect";

import type { RollResultSchema } from "~/engine/roll/schema/RollResultSchema";
import type { RollWeightSchema } from "~/engine/roll/schema/RollWeightSchema";
import { rollQuantityFx } from "~/engine/quantity/fx/rollQuantityFx";
import { selectDropWeightFx } from "./selectDropWeightFx";

export namespace rollWeightFx {
	export interface Props {
		roll: RollWeightSchema.Type;
	}
}

/**
 * Composes quantity resolution with repeated weighted drop selection.
 */
export const rollWeightFx = Effect.fn("rollWeightFx")(function* ({ roll }: rollWeightFx.Props) {
	const quantity = yield* rollQuantityFx({
		quantity: roll.quantity,
	});
	const drop: RollResultSchema.Type["drop"] = [];

	for (let index = 0; index < quantity; index += 1) {
		const selected = yield* selectDropWeightFx({
			drop: roll.drop,
		});
		drop.push(...selected.drop);
	}

	return {
		drop,
	} satisfies RollResultSchema.Type;
});
