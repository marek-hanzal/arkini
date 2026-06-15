import type { CraftProgressView } from "~/board/view/CraftProgressViewSchema";
import { formatMs } from "~/shared/util/formatMs";

export namespace craftStatusLabel {
	export interface Props {
		craft: CraftProgressView;
	}
}

export const craftStatusLabel = ({ craft }: craftStatusLabel.Props) => {
	if (craft.phase === "collecting_inputs") return "Collecting inputs";
	if (craft.phase === "waiting")
		return craft.remainingMs !== undefined
			? `Ready in ${formatMs(craft.remainingMs)}`
			: "Building";
	return "Ready";
};
