import type { DropSchema } from "~/v1/output/schema/DropSchema";

/**
 * Drop configurations selected by one roll.
 *
 * The drops are not resolved yet: quantity, rules, and placement belong to
 * later, independently composable runtime steps.
 */
export interface RollResult {
	readonly drop: ReadonlyArray<DropSchema.Type>;
}
