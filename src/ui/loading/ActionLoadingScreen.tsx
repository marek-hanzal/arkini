import { useEffect, useState } from "react";
import { LauncherScene } from "~/ui/launcher/LauncherScene";
import { routeContentViewTransitionName } from "~/ui/navigation/routeContentViewTransitionName";

export const defaultLoadingMinimumDurationMs = 2_500;

const initialProgress = 12;
const pendingProgressTransitionMs = 220;

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

/** Presents one route-owned progress curve and keeps its terminal frame full until navigation or shutdown. */
export const ActionLoadingScreen = ({
	completed = false,
	label,
}: {
	readonly completed?: boolean;
	readonly label: string;
}) => {
	const [progress, setProgress] = useState(completed ? 100 : initialProgress);
	const reducedMotion =
		typeof window.matchMedia === "function" &&
		window.matchMedia("(prefers-reduced-motion: reduce)").matches;

	useEffect(() => {
		if (completed) {
			setProgress(100);
			return;
		}
		setProgress(initialProgress);
		if (reducedMotion) return;
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
		reducedMotion,
	]);

	return (
		<LauncherScene
			compactHero
			dataUi="ActionLoadingScreen"
			layout="fixed-hero"
		>
			<div
				className="flex w-[min(80cqw,28rem)] max-w-full flex-col items-center gap-3"
				data-ui="ActionLoadingScreenContent"
				style={{
					viewTransitionName: routeContentViewTransitionName,
				}}
			>
				<div
					className="h-[clamp(0.375rem,1.25cqh,0.5rem)] w-full overflow-hidden rounded-full border border-line bg-surface-raised/60 shadow-inner"
					data-ui="ActionLoadingScreenProgress"
					role="progressbar"
					aria-label={label}
					aria-valuemin={0}
					aria-valuemax={100}
					aria-valuenow={progress}
				>
					<div
						className="size-full origin-left rounded-full bg-accent transition-transform ease-out motion-reduce:transition-none"
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
