import { Effect } from "effect";
import { match } from "ts-pattern";

import { RuleEnumSchema } from "~/engine/output/schema/drop/rule/RuleEnumSchema";
import type { BoardLocationSchema } from "~/engine/location/schema/BoardLocationSchema";
import type { DropResolutionSchema } from "~/engine/output/schema/DropResolutionSchema";
import type { DropSchema } from "~/engine/output/schema/DropSchema";
import { rollQuantityFx } from "~/engine/quantity/fx/rollQuantityFx";

import { dropRuleFx } from "./dropRuleFx";

export namespace dropFx {
	export interface Props {
		drop: DropSchema.Type;
		origin: BoardLocationSchema.Type;
	}
}

/**
 * Resolves one selected drop into one concrete result or undefined.
 *
 * Availability rules run before quantity resolution. The drop owns the
 * consumer-specific interpretation of neutral rule results. A rejected drop is
 * discarded without consuming quantity randomness, rerolling, or selecting a
 * replacement candidate.
 */
export const dropFx = Effect.fn("dropFx")(function* ({ drop, origin }: dropFx.Props) {
	const enabled = yield* Effect.every(drop.rules, (rule) => {
		return dropRuleFx({
			origin,
			rule,
		}).pipe(
			Effect.map((result) => {
				return match(result)
					.with(
						{
							type: RuleEnumSchema.enum.Enable,
						},
						({ active }) => active,
					)
					.with(
						{
							type: RuleEnumSchema.enum.Disable,
						},
						({ active }) => !active,
					)
					.exhaustive();
			}),
		);
	});
	if (!enabled) {
		return undefined;
	}

	const quantity = yield* rollQuantityFx({
		quantity: drop.quantity,
	});

	return {
		itemId: drop.itemId,
		placement: drop.placement,
		quantity,
	} satisfies DropResolutionSchema.Type;
});
