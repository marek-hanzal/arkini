import { useEffect, useState } from "react";
import { LauncherHeroAsset } from "~/ui/launcher/LauncherHeroAsset";

const initialProgress = 12;
const pendingProgressTransitionMs = 220;
const finalProgressTransitionMs = 180;
const completedProgressHoldMs = 150;

const pendingStages = [
	{
		afterMs: 180,
		progress: 28,
	},
	{
		afterMs: 420,
		progress: 46,
	},
	{
		afterMs: 780,
		progress: 64,
	},
	{
		afterMs: 1_300,
		progress: 78,
	},
	{
		afterMs: 2_100,
		progress: 87,
	},
	{
		afterMs: 3_400,
		progress: 94,
	},
] as const;

export namespace GameLoadingScreen {
	export interface Props {
		readonly onComplete?: () => void;
		readonly ready: boolean;
		readonly viewTransitionName?: string;
	}
}

/** Presents deterministic fake progress while the authoritative GameOwner bootstrap runs. */
export const GameLoadingScreen = ({
	onComplete,
	ready,
	viewTransitionName,
}: GameLoadingScreen.Props) => {
	const [progress, setProgress] = useState(initialProgress);
	const reducedMotion =
		typeof window.matchMedia === "function" &&
		window.matchMedia("(prefers-reduced-motion: reduce)").matches;

	useEffect(() => {
		if (ready || reducedMotion) return;
		setProgress(initialProgress);
		const timers = pendingStages.map(({ afterMs, progress: nextProgress }) =>
			window.setTimeout(() => setProgress(nextProgress), afterMs),
		);
		return () => {
			for (const timer of timers) window.clearTimeout(timer);
		};
	}, [
		ready,
		reducedMotion,
	]);

	useEffect(() => {
		if (!ready || onComplete === undefined) return;
		setProgress(100);
		const timer = window.setTimeout(
			onComplete,
			(reducedMotion ? 0 : finalProgressTransitionMs) + completedProgressHoldMs,
		);
		return () => window.clearTimeout(timer);
	}, [
		onComplete,
		ready,
		reducedMotion,
	]);

	return (
		<section
			className="relative flex size-full min-h-0 min-w-0 flex-col items-center justify-center overflow-hidden bg-canvas p-[clamp(1rem,4vmin,3rem)] text-foreground"
			data-ui="GameLoadingScreen"
		>
			<div
				className="flex w-[min(80dvw,56rem)] max-w-full flex-col items-center gap-[clamp(1.25rem,4vmin,2.5rem)]"
				data-ui="GameLoadingScreenPanel"
				style={{
					viewTransitionName,
				}}
			>
				<div
					className="h-[35dvh] min-h-28 w-full"
					data-ui="GameLoadingScreenHero"
				>
					<img
						src={LauncherHeroAsset.url}
						alt="Arkini"
						className="size-full object-contain drop-shadow-2xl"
						decoding="async"
						fetchPriority="high"
						loading="eager"
						draggable={false}
					/>
				</div>
				<div
					className="h-2 w-[min(80%,28rem)] overflow-hidden rounded-full border border-line bg-surface-raised/60 shadow-inner"
					data-ui="GameLoadingScreenProgress"
					role="progressbar"
					aria-label="Loading game"
					aria-valuemin={0}
					aria-valuemax={100}
					aria-valuenow={progress}
				>
					<div
						className="size-full origin-left rounded-full bg-accent transition-transform ease-out motion-reduce:transition-none"
						data-ui="GameLoadingScreenProgressFill"
						style={{
							transform: `scaleX(${progress / 100})`,
							transitionDuration: `${ready ? finalProgressTransitionMs : pendingProgressTransitionMs}ms`,
						}}
					/>
				</div>
			</div>
		</section>
	);
};
