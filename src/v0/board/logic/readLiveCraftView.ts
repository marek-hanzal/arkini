import type { CraftProgressView } from "~/v0/board/view/CraftProgressViewSchema";
import { readGameTimeProgress, readGameTimeRemainingMs } from "~/v0/game/time/GameTime";

export namespace readLiveCraftView {
	export interface Props {
		craft?: CraftProgressView;
		nowMs: number;
	}
}

export const readLiveCraftView = ({ craft, nowMs }: readLiveCraftView.Props) => {
	if (!craft) return undefined;
	if (craft.phase === "collecting_inputs" || craft.readyAtMs === undefined) return craft;

	const timeProgress =
		craft.startAtMs === undefined
			? craft.timeProgress
			: readGameTimeProgress({
					nowMs,
					readyAtMs: craft.readyAtMs,
					startAtMs: craft.startAtMs,
				});
	const ready = craft.readyAtMs <= nowMs;

	return {
		...craft,
		timeProgress,
		progress: timeProgress,
		phase: ready ? "ready" : "waiting",
		complete: ready,
		remainingMs: readGameTimeRemainingMs({
			nowMs,
			readyAtMs: craft.readyAtMs,
		}),
		canAcceptInputs: false,
		acceptedInputItemIds: [],
	} satisfies CraftProgressView;
};
