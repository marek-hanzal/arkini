import { Effect } from "effect";

import type { RollResult } from "~/v1/roll/RollResult";
import type { RollGuaranteedSchema } from "~/v1/roll/schema/RollGuaranteedSchema";

export namespace rollGuaranteedFx {
	export interface Props {
		roll: RollGuaranteedSchema.Type;
	}
}

/** Selects every configured drop from a guaranteed roll. */
export const rollGuaranteedFx = Effect.fn("rollGuaranteedFx")(function* ({
	roll,
}: rollGuaranteedFx.Props) {
	return {
		drop: roll.drop,
	} satisfies RollResult;
});
