import { useAnimationControls } from "motion/react";
import { type RefObject, useEffect, useState } from "react";
import { AboutPortraitAssets } from "~/ui/launcher/AboutPortraitAssets";

const firstDelayRangeMs = {
	maximum: 90_000,
	minimum: 30_000,
} as const;

const repeatDelayRangeMs = {
	maximum: 150_000,
	minimum: 60_000,
} as const;

const jumpscareDurationSeconds = 2.4;

const randomBetween = (minimum: number, maximum: number) =>
	minimum + Math.random() * (maximum - minimum);

const pickPortrait = () =>
	AboutPortraitAssets[Math.floor(Math.random() * AboutPortraitAssets.length)] ??
	AboutPortraitAssets[0];

/** Recycles one rare fullscreen portrait apparition with bounded random spacing. */
export const useAboutJumpscareMotion = ({
	active,
	containerRef,
}: {
	readonly active: boolean;
	readonly containerRef: RefObject<HTMLDivElement | null>;
}) => {
	const controls = useAnimationControls();
	const [portraitUrl, setPortraitUrl] = useState(AboutPortraitAssets[0]);

	useEffect(() => {
		if (!active) {
			controls.stop();
			controls.set({
				opacity: 0,
			});
			return;
		}

		let disposed = false;
		let timeout: number | undefined;

		const schedule = (delayMs: number) => {
			timeout = window.setTimeout(async () => {
				if (disposed) return;

				const container = containerRef.current;
				if (container === null) {
					schedule(500);
					return;
				}

				const startedAt = window.performance.now();
				const bounds = container.getBoundingClientRect();
				const fullscreenScale =
					(Math.max(bounds.width, bounds.height) / 256) * randomBetween(1.18, 1.42);
				const startRotation = randomBetween(-8, 8);

				setPortraitUrl(pickPortrait());
				controls.set({
					filter: "blur(14px)",
					opacity: 0,
					rotate: startRotation,
					scale: 0.15,
				});

				await controls.start({
					filter: [
						"blur(14px)",
						"blur(1px)",
						"blur(4px)",
						"blur(16px)",
					],
					opacity: [
						0,
						0.92,
						0.72,
						0,
					],
					rotate: startRotation + randomBetween(-5, 5),
					scale: [
						0.15,
						0.68,
						fullscreenScale * 0.78,
						fullscreenScale,
					],
					transition: {
						duration: jumpscareDurationSeconds,
						ease: [
							0.16,
							1,
							0.3,
							1,
						],
						times: [
							0,
							0.12,
							0.68,
							1,
						],
					},
				});

				if (disposed) return;

				const targetStartGapMs = randomBetween(
					repeatDelayRangeMs.minimum,
					repeatDelayRangeMs.maximum,
				);
				const elapsedMs = window.performance.now() - startedAt;
				schedule(Math.max(0, targetStartGapMs - elapsedMs));
			}, delayMs);
		};

		schedule(randomBetween(firstDelayRangeMs.minimum, firstDelayRangeMs.maximum));

		return () => {
			disposed = true;
			if (timeout !== undefined) window.clearTimeout(timeout);
			controls.stop();
		};
	}, [
		active,
		containerRef,
		controls,
	]);

	return {
		controls,
		portraitUrl,
	};
};
