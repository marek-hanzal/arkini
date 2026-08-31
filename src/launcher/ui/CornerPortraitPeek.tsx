import { motion } from "motion/react";
import { useEffect, useRef, useState } from "react";

const cornerPresentation = {
	"bottom-left": {
		anchorClassName: "bottom-0 left-0",
		rotate: 45,
		xDirection: -1,
		yDirection: 1,
	},
	"bottom-right": {
		anchorClassName: "bottom-0 right-0",
		rotate: -45,
		xDirection: 1,
		yDirection: 1,
	},
	"top-left": {
		anchorClassName: "left-0 top-0",
		rotate: 135,
		xDirection: -1,
		yDirection: -1,
	},
	"top-right": {
		anchorClassName: "right-0 top-0",
		rotate: -135,
		xDirection: 1,
		yDirection: -1,
	},
} as const;

type Corner = keyof typeof cornerPresentation;

interface CornerPortraitPeekState {
	readonly activePortraitIndex: number | undefined;
	readonly sizePx: number;
}

const initialState: CornerPortraitPeekState = {
	activePortraitIndex: undefined,
	sizePx: 208,
};

/** Randomly selects which already-mounted portrait peeks from this corner. */
const useCornerPortraitPeek = (active: boolean, portraitUrls: readonly string[]) => {
	const [peek, setPeekFn] = useState(initialState);
	const previousPortraitIndexRef = useRef<number | undefined>(undefined);

	useEffect(() => {
		const randomBetweenFn = (minimum: number, maximum: number) =>
			minimum + Math.random() * (maximum - minimum);
		if (!active) {
			setPeekFn((current) => ({
				...current,
				activePortraitIndex: undefined,
			}));
			return;
		}

		let disposed = false;
		let timeout: number | undefined;

		const schedulePeekFn = () => {
			timeout = window.setTimeout(
				() => {
					if (disposed) return;

					const candidates = portraitUrls
						.map((_, index) => index)
						.filter((index) => index !== previousPortraitIndexRef.current);
					const nextIndex =
						candidates[Math.floor(Math.random() * candidates.length)] ?? 0;
					previousPortraitIndexRef.current = nextIndex;
					setPeekFn({
						activePortraitIndex: nextIndex,
						sizePx: Math.round(randomBetweenFn(176, 248)),
					});

					timeout = window.setTimeout(
						() => {
							if (disposed) return;
							setPeekFn((current) => ({
								...current,
								activePortraitIndex: undefined,
							}));
							timeout = window.setTimeout(
								schedulePeekFn,
								randomBetweenFn(700, 3_200),
							);
						},
						randomBetweenFn(1_100, 2_300),
					);
				},
				randomBetweenFn(350, 2_800),
			);
		};

		schedulePeekFn();
		return () => {
			disposed = true;
			if (timeout !== undefined) window.clearTimeout(timeout);
		};
	}, [
		active,
		portraitUrls,
	]);

	return peek;
};

/** Keeps all portraits mounted in one corner and lets a random one peek inward. */
export const CornerPortraitPeek = ({
	active,
	corner,
	portraitUrls,
}: {
	readonly active: boolean;
	readonly corner: Corner;
	readonly portraitUrls: readonly string[];
}) => {
	const { activePortraitIndex, sizePx } = useCornerPortraitPeek(active, portraitUrls);
	const presentation = cornerPresentation[corner];
	const hiddenOffsetPx = sizePx * 1.05;
	const peekOffsetPx = sizePx * 0.2;

	return portraitUrls.map((portraitUrl, portraitIndex) => {
		const visible = activePortraitIndex === portraitIndex;
		const offsetPx = visible ? peekOffsetPx : hiddenOffsetPx;

		return (
			<motion.div
				animate={{
					opacity: visible ? 0.96 : 0,
					rotate: presentation.rotate,
					scale: visible ? 1 : 0.88,
					x: presentation.xDirection * offsetPx,
					y: presentation.yDirection * offsetPx,
				}}
				className={`absolute ${presentation.anchorClassName} z-20 overflow-hidden rounded-full border-2 border-line-strong bg-surface-raised shadow-2xl will-change-transform`}
				data-corner={corner}
				data-ui="CornerPortraitPeekPortrait"
				initial={false}
				key={portraitUrl}
				style={{
					height: sizePx,
					width: sizePx,
				}}
				transition={{
					duration: visible ? 0.55 : 0.42,
					ease: visible
						? [
								0.16,
								1,
								0.3,
								1,
							]
						: [
								0.7,
								0,
								0.84,
								0,
							],
				}}
			>
				<img
					alt=""
					className="size-full object-cover"
					draggable={false}
					src={portraitUrl}
				/>
			</motion.div>
		);
	});
};
