import type { CraftProgressView } from "~/v0/board/view/CraftProgressViewSchema";
import { formatMs } from "~/v0/style/formatMs";

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
