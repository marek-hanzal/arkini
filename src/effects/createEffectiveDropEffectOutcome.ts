import type { EffectiveDropEffectOutcome } from "~/effects/EffectiveLine";
import type { DropEffect } from "~/effects/RuntimeLineEffectTypes";

export const shouldDisplayEffectiveDropEffect = (effect: EffectiveDropEffectOutcome) => {
	if (effect.display === "never") return false;
	if (effect.display === "always") return true;
	if (effect.display === "whenMissing") return !effect.ready;
	return effect.active;
};

export const createEffectiveDropEffectOutcome = ({
	active,
	effect,
	effectId,
	effectName,
	impact,
	label,
	ready,
	result,
}: {
	active: boolean;
	effect: DropEffect;
	effectId: string;
	effectName: string;
	impact: EffectiveDropEffectOutcome["impact"];
	label?: string;
	ready: boolean;
	result: string;
}): EffectiveDropEffectOutcome => ({
	active,
	display: effect.display,
	effectId,
	effectName,
	impact,
	kind: effect.kind,
	label: label ?? effect.label ?? effectName,
	phase: "phase" in effect ? effect.phase : undefined,
	ready,
	result,
});
