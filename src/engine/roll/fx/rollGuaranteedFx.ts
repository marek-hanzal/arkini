import { Effect } from "effect";

import type { RollGuaranteedSchema } from "~/engine/roll/schema/RollGuaranteedSchema";
import type { RollResultSchema } from "~/engine/roll/schema/RollResultSchema";

export namespace rollGuaranteedFx {
	export interface Props {
		roll: RollGuaranteedSchema.Type;
	}
}

/**
 * Selects every configured drop from a guaranteed roll.
 */
export const rollGuaranteedFx = Effect.fn("rollGuaranteedFx")(function* ({
	roll,
}: rollGuaranteedFx.Props) {
	return {
		drop: roll.drop,
	} satisfies RollResultSchema.Type;
});
