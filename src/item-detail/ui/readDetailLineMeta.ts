import type { LineView } from "~/board/view/LineViewSchema";
import { formatDetailLineMultiplier } from "~/item-detail/ui/formatDetailLineMultiplier";
import { formatMs } from "~/time/formatMs";
import { joinTextParts } from "~/ui/joinTextParts";

export const readDetailLineMeta = (line: LineView) =>
	joinTextParts([
		line.kind === "effect"
			? `Window ${formatMs(line.durationMs)}`
			: `Queue ${line.queueUsed}/${line.queueMax}`,
		line.kind === "product" ? formatMs(line.durationMs) : undefined,
		line.effectDurationMultiplier && line.effectDurationMultiplier < 1
			? `faster ${formatDetailLineMultiplier(line.effectDurationMultiplier)}×`
			: line.effectDurationMultiplier && line.effectDurationMultiplier > 1
				? `slowed ${formatDetailLineMultiplier(line.effectDurationMultiplier)}×`
				: undefined,
	]);
