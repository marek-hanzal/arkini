import { motion, useAnimationControls } from "motion/react";
import { type RefObject, useEffect, useRef, useState } from "react";

const firstDelayRangeMs = {
	maximum: 90_000,
	minimum: 30_000,
} as const;

const repeatDelayRangeMs = {
	maximum: 150_000,
	minimum: 60_000,
} as const;

const jumpscareDurationSeconds = 2.4;

/** Recycles this apparition with bounded random spacing while its owner stays active. */
const useAboutJumpscareMotion = ({
	active,
	containerRef,
	portraitUrls,
}: {
	readonly active: boolean;
	readonly containerRef: RefObject<HTMLDivElement | null>;
	readonly portraitUrls: readonly string[];
}) => {
	const controls = useAnimationControls();
	const [portraitUrl, setPortraitUrl] = useState(portraitUrls[0] ?? "");

	useEffect(() => {
		const randomBetween = (minimum: number, maximum: number) =>
			minimum + Math.random() * (maximum - minimum);
		const pickPortrait = (urls: readonly string[]) =>
			urls[Math.floor(Math.random() * urls.length)] ?? urls[0] ?? "";
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

				setPortraitUrl(pickPortrait(portraitUrls));
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
		portraitUrls,
	]);

	return {
		controls,
		portraitUrl,
	};
};

/** Renders the rare foreground portrait apparition for the About-page easter egg. */
export const AboutJumpscare = ({
	active,
	portraitUrls,
}: {
	readonly active: boolean;
	readonly portraitUrls: readonly string[];
}) => {
	const containerRef = useRef<HTMLDivElement>(null);
	const { controls, portraitUrl } = useAboutJumpscareMotion({
		active,
		containerRef,
		portraitUrls,
	});

	return (
		<div
			aria-hidden="true"
			className="pointer-events-none relative size-full overflow-hidden"
			data-ui="AboutJumpscare"
			ref={containerRef}
		>
			<div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
				<motion.img
					alt=""
					animate={controls}
					className="size-64 max-w-none select-none drop-shadow-[0_0_3rem_rgba(255,255,255,0.78)] will-change-transform"
					draggable={false}
					initial={{
						opacity: 0,
						scale: 0.15,
					}}
					src={portraitUrl}
				/>
			</div>
		</div>
	);
};
