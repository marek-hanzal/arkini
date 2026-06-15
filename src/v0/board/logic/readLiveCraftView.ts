import type { CraftProgressView } from "~/v0/board/view/CraftProgressViewSchema";

export namespace readLiveCraftView {
	export interface Props {
		craft?: CraftProgressView;
		nowMs: number;
	}
}

export const readLiveCraftView = ({ craft, nowMs }: readLiveCraftView.Props) => {
	if (!craft) return undefined;
	if (craft.phase === "collecting_inputs" || craft.readyAtMs === undefined) return craft;

	const timeProgress = Math.max(
		0,
		Math.min(
			1,
			craft.startedAtMs === undefined
				? craft.timeProgress
				: (nowMs - craft.startedAtMs) / Math.max(1, craft.readyAtMs - craft.startedAtMs),
		),
	);
	const ready = craft.readyAtMs <= nowMs;

	return {
		...craft,
		timeProgress,
		progress: timeProgress,
		phase: ready ? "ready" : "waiting",
		complete: ready,
		remainingMs: Math.max(0, craft.readyAtMs - nowMs),
		canAcceptInputs: false,
		acceptedInputItemIds: [],
	} satisfies CraftProgressView;
};
