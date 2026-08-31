import { useEffect, useState } from "react";

import { LauncherScene } from "~/launcher/ui/LauncherScene";

const pendingProgressTransitionMs = 220;
const actionProgressViewTransitionName = "arkini-action-progress";
const initialProgress = 12;
/** Keeps route admission and its progress curve on the same readable minimum duration. */
export const ActionLoadingMinimumDurationMs = 2_500;
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

interface ActionLoadingScreenProps {
	readonly completed?: boolean;
	readonly durationMs?: number;
	readonly label: string;
}

const useProgress = (completed: boolean, durationMs: number) => {
	const [progress, setProgressFn] = useState(completed ? 100 : initialProgress);

	useEffect(() => {
		if (completed) {
			setProgressFn(100);
			return;
		}
		setProgressFn(initialProgress);
		const timers = pendingStages.map((stage) =>
			window.setTimeout(() => setProgressFn(stage.progress), durationMs * stage.at),
		);
		return () => {
			for (const timer of timers) window.clearTimeout(timer);
		};
	}, [
		completed,
		durationMs,
	]);

	return progress;
};

/** Presents one Action progress curve and keeps its terminal frame full until its owner settles. */
export const ActionLoadingScreen = ({
	completed = false,
	durationMs = ActionLoadingMinimumDurationMs,
	label,
}: ActionLoadingScreenProps) => {
	const progress = useProgress(completed, durationMs);
	return (
		<LauncherScene
			compactHero
			cursor="wait"
			dataUi="ActionLoadingScreen"
			layout="fixed-hero"
		>
			<div
				className="flex w-[min(80cqw,28rem)] max-w-full flex-col items-center gap-3"
				data-ui="ActionLoadingScreenContent"
				style={{
					viewTransitionName: actionProgressViewTransitionName,
				}}
			>
				<div
					className="h-[clamp(0.375rem,1.25cqh,0.5rem)] w-full overflow-hidden rounded-full border border-line bg-surface-raised/60 shadow-inner"
					data-ui="ActionLoadingScreenProgress"
				>
					<div
						className="size-full origin-left rounded-full bg-accent transition-transform ease-out"
						data-ui="ActionLoadingScreenProgressFill"
						style={{
							transform: `scaleX(${progress / 100})`,
							transitionDuration: `${pendingProgressTransitionMs}ms`,
						}}
					/>
				</div>
				<p
					className="text-center text-sm font-medium text-muted"
					data-ui="ActionLoadingScreenLabel"
				>
					{label}
				</p>
			</div>
		</LauncherScene>
	);
};
