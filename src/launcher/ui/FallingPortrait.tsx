import { motion, useAnimationControls } from "motion/react";
import { type RefObject, useEffect, useState } from "react";

interface FallingPortraitAppearance {
	readonly blurPx: number;
	readonly portraitUrl: string;
	readonly sizePx: number;
	readonly zIndex: number;
}

/** Recycles this stable portrait node through one continuous Motion trajectory. */
const useFallingPortraitMotion = ({
	active,
	containerRef,
	initialDelayMs,
	portraitUrls,
}: {
	readonly active: boolean;
	readonly containerRef: RefObject<HTMLDivElement | null>;
	readonly initialDelayMs: number;
	readonly portraitUrls: readonly string[];
}) => {
	const controls = useAnimationControls();
	const [appearance, setAppearanceFn] = useState<FallingPortraitAppearance>({
		blurPx: 0,
		portraitUrl: portraitUrls[0] ?? "",
		sizePx: 64,
		zIndex: 1,
	});

	useEffect(() => {
		const randomBetweenFn = (minimum: number, maximum: number) =>
			minimum + Math.random() * (maximum - minimum);
		const waitFn = (milliseconds: number) =>
			new Promise<void>((resolveFn) => window.setTimeout(resolveFn, milliseconds));
		const pickPortraitFn = (urls: readonly string[]) =>
			urls[Math.floor(Math.random() * urls.length)] ?? urls[0] ?? "";
		if (!active) {
			controls.stop();
			controls.set({
				opacity: 0,
			});
			return;
		}

		let disposed = false;

		const runFn = async () => {
			await waitFn(initialDelayMs);

			while (!disposed) {
				const container = containerRef.current;
				if (container === null) {
					await waitFn(100);
					continue;
				}

				const bounds = container.getBoundingClientRect();
				const depth = Math.random();
				const sizePx = Math.round(92 + depth * 164);
				const opacity = randomBetweenFn(0.36, 0.48) + depth * 0.45;
				const durationSeconds = randomBetweenFn(8.5, 11.5) - depth * 2.25;
				const cycleDurationSeconds = randomBetweenFn(11.5, 13.5);
				const startX = randomBetweenFn(
					-sizePx * 0.15,
					Math.max(0, bounds.width - sizePx * 0.85),
				);
				const endX = Math.min(
					Math.max(startX + randomBetweenFn(-90, 90), -sizePx * 0.25),
					bounds.width - sizePx * 0.75,
				);
				const startRotation = randomBetweenFn(-28, 28);
				const endRotation = startRotation + randomBetweenFn(-190, 190);

				setAppearanceFn({
					blurPx: (1 - depth) * 1.1,
					portraitUrl: pickPortraitFn(portraitUrls),
					sizePx,
					zIndex: 1 + Math.round(depth * 8),
				});
				controls.set({
					opacity: 0,
					rotate: startRotation,
					x: startX,
					y: -sizePx - 20,
				});

				await controls.start({
					opacity: [
						0,
						opacity,
						opacity,
						0,
					],
					rotate: endRotation,
					x: endX,
					y: bounds.height + sizePx + 20,
					transition: {
						duration: durationSeconds,
						ease: "linear",
						opacity: {
							duration: durationSeconds,
							ease: "linear",
							times: [
								0,
								0.08,
								0.88,
								1,
							],
						},
					},
				});

				await waitFn(Math.max(0.9, cycleDurationSeconds - durationSeconds) * 1_000);
			}
		};

		void runFn();
		return () => {
			disposed = true;
			controls.stop();
		};
	}, [
		active,
		containerRef,
		controls,
		initialDelayMs,
		portraitUrls,
	]);

	return {
		appearance,
		controls,
	};
};

/** Renders one stable portrait ball from the recycled About-page falling pool. */
export const FallingPortrait = ({
	active,
	containerRef,
	initialDelayMs,
	portraitUrls,
}: {
	readonly active: boolean;
	readonly containerRef: RefObject<HTMLDivElement | null>;
	readonly initialDelayMs: number;
	readonly portraitUrls: readonly string[];
}) => {
	const { appearance, controls } = useFallingPortraitMotion({
		active,
		containerRef,
		initialDelayMs,
		portraitUrls,
	});

	return (
		<motion.div
			animate={controls}
			className="absolute left-0 top-0 overflow-hidden rounded-full border-2 border-line-strong bg-surface-raised shadow-xl will-change-transform"
			data-ui="FallingPortrait"
			initial={{
				opacity: 0,
			}}
			style={{
				filter: `blur(${appearance.blurPx}px)`,
				height: appearance.sizePx,
				width: appearance.sizePx,
				zIndex: appearance.zIndex,
			}}
		>
			<img
				alt=""
				className="size-full object-cover"
				draggable={false}
				src={appearance.portraitUrl}
			/>
		</motion.div>
	);
};
