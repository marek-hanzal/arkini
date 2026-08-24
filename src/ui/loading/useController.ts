import { useEffect, useMemo, useState } from "react";

import { defaultLoadingMinimumDurationMs } from "~/ui/loading/defaultLoadingMinimumDurationMs";

const initialProgress = 12;

const pendingStages = [
	{
		at: 0.08,
		progress: 28,
	},
	{
		at: 0.2,
		progress: 46,
	},
	{
		at: 0.38,
		progress: 64,
	},
	{
		at: 0.6,
		progress: 78,
	},
	{
		at: 0.82,
		progress: 87,
	},
	{
		at: 0.94,
		progress: 94,
	},
] as const;

export namespace useController {
	export interface Props {
		readonly completed?: boolean;
	}

	export interface Output {
		readonly progress: number;
	}
}

export const useController = ({ completed = false }: useController.Props): useController.Output => {
	const [progress, setProgress] = useState(completed ? 100 : initialProgress);

	useEffect(() => {
		if (completed) {
			setProgress(100);
			return;
		}
		setProgress(initialProgress);
		const timers = pendingStages.map((stage) =>
			window.setTimeout(
				() => setProgress(stage.progress),
				defaultLoadingMinimumDurationMs * stage.at,
			),
		);
		return () => {
			for (const timer of timers) window.clearTimeout(timer);
		};
	}, [
		completed,
	]);

	return useMemo(
		() => ({
			progress,
		}),
		[
			progress,
		],
	);
};
