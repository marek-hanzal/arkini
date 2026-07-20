import { useAnimationControls } from "motion/react";
import { type RefObject, useEffect, useState } from "react";
import { AboutPortraitAssets } from "~/ui/launcher/AboutPortraitAssets";

const randomBetween = (minimum: number, maximum: number) =>
	minimum + Math.random() * (maximum - minimum);

const wait = (milliseconds: number) =>
	new Promise<void>((resolve) => window.setTimeout(resolve, milliseconds));

const pickPortrait = () =>
	AboutPortraitAssets[Math.floor(Math.random() * AboutPortraitAssets.length)] ??
	AboutPortraitAssets[0];

interface FallingPortraitAppearance {
	readonly blurPx: number;
	readonly portraitUrl: string;
	readonly sizePx: number;
	readonly zIndex: number;
}

const initialAppearance: FallingPortraitAppearance = {
	blurPx: 0,
	portraitUrl: AboutPortraitAssets[0],
	sizePx: 64,
	zIndex: 1,
};

/** Owns one stable falling portrait node and continuously recycles its Motion trajectory. */
export const useFallingPortraitMotion = ({
	active,
	containerRef,
	initialDelayMs,
}: {
	readonly active: boolean;
	readonly containerRef: RefObject<HTMLDivElement | null>;
	readonly initialDelayMs: number;
}) => {
	const controls = useAnimationControls();
	const [appearance, setAppearance] = useState(initialAppearance);

	useEffect(() => {
		if (!active) {
			controls.stop();
			controls.set({
				opacity: 0,
			});
			return;
		}

		let disposed = false;

		const run = async () => {
			await wait(initialDelayMs);

			while (!disposed) {
				const container = containerRef.current;
				if (container === null) {
					await wait(100);
					continue;
				}

				const bounds = container.getBoundingClientRect();
				const depth = Math.random();
				const sizePx = Math.round(92 + depth * 164);
				const opacity = randomBetween(0.36, 0.48) + depth * 0.45;
				const durationSeconds = randomBetween(8.5, 11.5) - depth * 2.25;
				const cycleDurationSeconds = randomBetween(11.5, 13.5);
				const startX = randomBetween(
					-sizePx * 0.15,
					Math.max(0, bounds.width - sizePx * 0.85),
				);
				const endX = Math.min(
					Math.max(startX + randomBetween(-90, 90), -sizePx * 0.25),
					bounds.width - sizePx * 0.75,
				);
				const startRotation = randomBetween(-28, 28);
				const endRotation = startRotation + randomBetween(-190, 190);

				setAppearance({
					blurPx: (1 - depth) * 1.1,
					portraitUrl: pickPortrait(),
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

				await wait(Math.max(0.9, cycleDurationSeconds - durationSeconds) * 1_000);
			}
		};

		void run();
		return () => {
			disposed = true;
			controls.stop();
		};
	}, [
		active,
		containerRef,
		controls,
		initialDelayMs,
	]);

	return {
		appearance,
		controls,
	};
};
