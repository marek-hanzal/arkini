import { useEffect, useState } from "react";
import { LauncherScene } from "~/ui/launcher/LauncherScene";
import { routeSceneViewTransitionName } from "~/ui/navigation/routeSceneViewTransitionName";

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

/** Presents one deliberately incomplete progress curve while its route loader owns the real work. */
export const ActionLoadingScreen = ({ label }: { readonly label: string }) => {
	const [progress, setProgress] = useState(initialProgress);
	const reducedMotion =
		typeof window.matchMedia === "function" &&
		window.matchMedia("(prefers-reduced-motion: reduce)").matches;

	useEffect(() => {
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
		reducedMotion,
	]);

	return (
		<LauncherScene
			compactHero
			dataUi="ActionLoadingScreen"
			layout="fixed-hero"
			viewTransitionName={routeSceneViewTransitionName}
		>
			<div
				className="flex w-[min(80cqw,56rem)] max-w-full flex-col items-center gap-[var(--ak-viewport-gap)]"
				data-ui="ActionLoadingScreenPanel"
			>
				<div className="flex w-full flex-col items-center gap-3">
					<div
						className="h-[clamp(0.375rem,1.25cqh,0.5rem)] w-[min(80%,28rem)] overflow-hidden rounded-full border border-line bg-surface-raised/60 shadow-inner"
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
			</div>
		</LauncherScene>
	);
};
