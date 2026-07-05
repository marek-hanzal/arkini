import type { LineView } from "~/board/view/LineViewSchema";
import type { EffectDetailPolarity } from "~/item-detail/ui/effectDetailPresentation";

export const readDetailLineEffectPolarity = (line: LineView): EffectDetailPolarity | undefined => {
	if (line.kind !== "effect") return undefined;
	return line.effectPolarity;
};
