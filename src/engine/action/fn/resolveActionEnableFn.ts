import type { resolveActionRuleFx } from "~/engine/action/fx/resolveActionRuleFx";
import { RuleTypeSchema } from "~/engine/action/schema/RuleTypeSchema";

/** Applies positive enable gates before the canonical disable veto. */
export const resolveActionEnableFn = ({
	enable,
	rules,
}: {
	readonly enable: boolean;
	readonly rules: ReadonlyArray<resolveActionRuleFx.Result>;
}) => {
	const enableRules = rules.filter((rule) => rule.type === RuleTypeSchema.enum.Enable);
	const enabled = enableRules.length > 0 ? enableRules.every((rule) => rule.active) : enable;
	const disabled = rules.some((rule) => rule.type === RuleTypeSchema.enum.Disable && rule.active);
	return enabled && !disabled;
};
