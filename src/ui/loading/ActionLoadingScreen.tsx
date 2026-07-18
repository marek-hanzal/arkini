import { useEffect, useState } from "react";
import { LauncherHero } from "~/ui/launcher/LauncherHero";
import { actionLoadingViewTransitionName } from "~/ui/navigation/actionLoadingViewTransitionName";

export const defaultLoadingMinimumDurationMs = 2_500;
export const defaultLoadingCompletedHoldMs = 350;

const initialProgress = 12;
const pendingProgressTransitionMs = 220;
const finalProgressTransitionMs = 180;

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

export namespace ActionLoadingScreen {
	export interface Props {
		readonly action?: Promise<void>;
		readonly completedHoldMs?: number;
		readonly label: string;
		readonly minimumDurationMs?: number;
		readonly onComplete?: () => void;
		readonly onError?: (error: unknown) => void;
	}
}

/** Presents staged progress over one real asynchronous action without claiming early completion. */
export const ActionLoadingScreen = ({
	action,
	completedHoldMs = defaultLoadingCompletedHoldMs,
	label,
	minimumDurationMs = defaultLoadingMinimumDurationMs,
	onComplete,
	onError,
}: ActionLoadingScreen.Props) => {
	const [progress, setProgress] = useState(initialProgress);
	const reducedMotion =
		typeof window.matchMedia === "function" &&
		window.matchMedia("(prefers-reduced-motion: reduce)").matches;

	useEffect(() => {
		let cancelled = false;
		const timers = new Set<number>();
		const schedule = (callback: () => void, afterMs: number) => {
			const timer = window.setTimeout(() => {
				timers.delete(timer);
				callback();
			}, afterMs);
			timers.add(timer);
			return timer;
		};
		const clearTimers = () => {
			for (const timer of timers) window.clearTimeout(timer);
			timers.clear();
		};

		setProgress(initialProgress);
		if (!reducedMotion) {
			for (const stage of pendingStages) {
				schedule(() => setProgress(stage.progress), minimumDurationMs * stage.at);
			}
		}
		if (action === undefined) {
			return () => {
				cancelled = true;
				clearTimers();
			};
		}

		const minimumDuration = new Promise<void>((resolve) => {
			schedule(resolve, minimumDurationMs);
		});
		void Promise.allSettled([
			action,
			minimumDuration,
		]).then(([actionResult]) => {
			if (cancelled) return;
			clearTimers();
			if (actionResult?.status === "rejected") {
				onError?.(actionResult.reason);
				return;
			}
			setProgress(100);
			schedule(
				() => onComplete?.(),
				(reducedMotion ? 0 : finalProgressTransitionMs) + completedHoldMs,
			);
		});

		return () => {
			cancelled = true;
			clearTimers();
		};
	}, [
		action,
		completedHoldMs,
		minimumDurationMs,
		onComplete,
		onError,
		reducedMotion,
	]);

	return (
		<section
			className="relative flex size-full min-h-0 min-w-0 flex-col items-center justify-center overflow-hidden bg-canvas p-[clamp(1rem,4vmin,3rem)] text-foreground"
			data-ui="ActionLoadingScreen"
			style={{
				viewTransitionName: actionLoadingViewTransitionName,
			}}
		>
			<div
				className="flex w-[min(80dvw,56rem)] max-w-full flex-col items-center gap-[clamp(1.25rem,4vmin,2.5rem)]"
				data-ui="ActionLoadingScreenPanel"
			>
				<LauncherHero compact />
				<div className="flex w-full flex-col items-center gap-3">
					<div
						className="h-2 w-[min(80%,28rem)] overflow-hidden rounded-full border border-line bg-surface-raised/60 shadow-inner"
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
								transitionDuration: `${progress === 100 ? finalProgressTransitionMs : pendingProgressTransitionMs}ms`,
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
		</section>
	);
};
