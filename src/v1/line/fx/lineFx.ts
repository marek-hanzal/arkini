import { Array, Effect } from "effect";

import type { LineResultSchema } from "~/v1/line/schema/LineResultSchema";
import type { LineSchema } from "~/v1/line/schema/LineSchema";
import type { RuntimeItemSchema } from "~/v1/runtime/schema/RuntimeItemSchema";
import { lineRuleFx } from "./lineRuleFx";

export namespace lineFx {
	export interface Props {
		line: LineSchema.Type;
		origin: RuntimeItemSchema.Type;
	}
}

/**
 * Resolves the dynamic visibility, availability, and runtime of one product line.
 *
 * Inputs and outputs are intentionally not evaluated here. Output randomness is
 * consumed only when a completed job resolves its output.
 */
export const lineFx = Effect.fn("lineFx")(function* ({ line, origin }: lineFx.Props) {
	const rules = yield* Effect.forEach(line.rules, (rule) => {
		return lineRuleFx({
			origin,
			rule,
		});
	});
	const show = Array.some(rules, (rule) => {
		return rule.type === "show" && rule.active;
	});
	const hide = Array.some(rules, (rule) => {
		return rule.type === "hide" && rule.active;
	});
	const enableRules = Array.filter(rules, (rule) => {
		return rule.type === "enable";
	});
	const enable =
		enableRules.length === 0
			? line.enable
			: Array.every(enableRules, (rule) => {
					return rule.active;
				});
	const disable = Array.some(rules, (rule) => {
		return rule.type === "disable" && rule.active;
	});
	const runtimeMultiplier = Array.reduce(rules, 1, (multiplier, rule) => {
		if (rule.type !== "runtime:multiplier" || !rule.active) {
			return multiplier;
		}

		return multiplier * rule.multiplier;
	});

	return {
		enable: !disable && enable,
		id: line.id,
		runtimeMs: Math.ceil(line.runtimeMs * runtimeMultiplier),
		show: !hide && (line.show || show),
	} satisfies LineResultSchema.Type;
});
