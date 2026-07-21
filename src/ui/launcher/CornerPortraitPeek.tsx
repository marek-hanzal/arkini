import { motion } from "motion/react";
import { useCornerPortraitPeek } from "~/ui/launcher/useCornerPortraitPeek";

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

export namespace CornerPortraitPeek {
	export type Corner = keyof typeof cornerPresentation;
}

/** Keeps all portraits mounted in one corner and lets a random one peek inward. */
export const CornerPortraitPeek = ({
	active,
	corner,
	portraitUrls,
}: {
	readonly active: boolean;
	readonly corner: CornerPortraitPeek.Corner;
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
