import { Effect } from "effect";

import type { RuleSchema } from "~/production-action/schema/RuleSchema";
import type { GridLocationSchema } from "~/item-location/schema/GridLocationSchema";
import { whenFx } from "~/production-condition/fx/whenFx";

export namespace resolveActionRuleFx {
	export type Result =
		| {
				readonly active: boolean;
				readonly type: "enable";
		  }
		| {
				readonly active: boolean;
				readonly type: "disable";
		  };
}

/** Evaluates one immediate-action availability rule from a real visible origin. */
export const resolveActionRuleFx = Effect.fn("resolveActionRuleFx")(function* ({
	origin,
	rule,
}: {
	readonly origin: GridLocationSchema.Type;
	readonly rule: RuleSchema.Type;
}) {
	let active = true;
	for (const when of rule.when) {
		if (
			!(yield* whenFx({
				origin,
				when,
			}))
		) {
			active = false;
			break;
		}
	}
	return {
		active,
		type: rule.type,
	} satisfies resolveActionRuleFx.Result;
});
