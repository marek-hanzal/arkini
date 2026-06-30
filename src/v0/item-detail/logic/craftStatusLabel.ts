import type { CraftProgressView } from "~/v0/board/view/CraftProgressViewSchema";
import { formatMs } from "~/v0/time/formatMs";

export namespace craftStatusLabel {
	export interface Props {
		craft: CraftProgressView;
	}
}

export const craftStatusLabel = ({ craft }: craftStatusLabel.Props) => {
	if (craft.phase === "collecting_inputs") {
		if (craft.targetLimitBlocked) return "Limit reached";
		if (craft.effectBlocked) return "Blocked";
		if (craft.startRequirementsReady === false) return "Requirements missing";
		return "Collecting inputs";
	}
	if (craft.phase === "waiting")
		return craft.remainingMs !== undefined
			? `Ready in ${formatMs(craft.remainingMs)}`
			: "Building";
	if (craft.phase === "paused") return "Paused";
	if (craft.phase === "delivery_blocked") return "Delivery blocked";
	return "Ready";
};
