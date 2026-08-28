import { Effect } from "effect";

import type { GuaranteedSchema } from "~/engine/roll/schema/GuaranteedSchema";
import type { RollResultSchema } from "~/engine/roll/schema/RollResultSchema";

export namespace rollGuaranteedFx {
	export interface Props {
		roll: GuaranteedSchema.Type;
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
