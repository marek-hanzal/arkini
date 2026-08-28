import { Effect } from "effect";

import { ActionRuleEnumSchema } from "~/engine/action/schema/ActionRuleEnumSchema";
import type {
	ActionRuleDisableResultSchema,
	ActionRuleEnableResultSchema,
} from "~/engine/action/schema/ActionRuleResultSchema";

/** Applies positive enable gates before the canonical disable veto. */
export const resolveActionEnableFx = Effect.fn("resolveActionEnableFx")(function* ({
	enable,
	rules,
}: {
	readonly enable: boolean;
	readonly rules: ReadonlyArray<
		ActionRuleEnableResultSchema.Type | ActionRuleDisableResultSchema.Type
	>;
}) {
	const enableRules = rules.filter((rule) => rule.type === ActionRuleEnumSchema.enum.Enable);
	const enabled = enableRules.length > 0 ? enableRules.every((rule) => rule.active) : enable;
	const disabled = rules.some(
		(rule) => rule.type === ActionRuleEnumSchema.enum.Disable && rule.active,
	);
	return enabled && !disabled;
});
