import { match } from "ts-pattern";
import { createEffectiveDropEffectOutcome } from "~/effects/createEffectiveDropEffectOutcome";
import type {
	EffectiveDropEffectApplicationPropsFor,
	EffectiveDropEvaluation,
} from "~/effects/EffectiveDropEvaluation";
import type { DropEffect } from "~/effects/RuntimeLineEffectTypes";
import { readDropEffectGrantActive } from "~/effects/readDropEffectGrantActive";

type GrantDropToggleEffectKind = Extract<
	DropEffect,
	{
		kind: "grant.drop.disable" | "grant.drop.enable" | "grant.drop.hide" | "grant.drop.show";
	}
>["kind"];

export const applyGrantDropToggleEffect = ({
	chanceItems,
	dropEffectId,
	dropEffectName,
	effect,
	enabled,
	grantIds,
	visible,
}: EffectiveDropEffectApplicationPropsFor<GrantDropToggleEffectKind>): EffectiveDropEvaluation => {
	const active = readDropEffectGrantActive({
		effect,
		grantIds,
	});
	const nextState = match(effect.kind)
		.with("grant.drop.hide", () => ({
			enabled,
			impact: "visibility" as const,
			ready: !active,
			result: active ? "hidden" : "inactive",
			visible: active ? false : visible,
		}))
		.with("grant.drop.show", () => ({
			enabled,
			impact: "visibility" as const,
			ready: active,
			result: active ? "shown" : "inactive",
			visible: active ? true : visible,
		}))
		.with("grant.drop.disable", () => ({
			enabled: active ? false : enabled,
			impact: "availability" as const,
			ready: !active,
			result: active ? "disabled" : "inactive",
			visible,
		}))
		.with("grant.drop.enable", () => ({
			enabled: active ? true : enabled,
			impact: "availability" as const,
			ready: active,
			result: active ? "enabled" : "inactive",
			visible,
		}))
		.exhaustive();

	return {
		chanceItems: [
			...chanceItems,
		],
		dropEffects: [
			createEffectiveDropEffectOutcome({
				active,
				effect,
				effectId: dropEffectId,
				effectName: dropEffectName,
				impact: nextState.impact,
				ready: nextState.ready,
				result: nextState.result,
			}),
		],
		enabled: nextState.enabled,
		visible: nextState.visible,
	};
};
