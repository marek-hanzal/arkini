import { motion } from "motion/react";
import { AboutPortraitAssets } from "~/ui/launcher/AboutPortraitAssets";
import { useCornerPortraitPeek } from "~/ui/launcher/useCornerPortraitPeek";

const cornerPresentation = {
	"bottom-left": {
		anchorClassName: "bottom-0 left-0",
		hiddenX: -88,
		hiddenY: 88,
		peekX: -42,
		peekY: 42,
		rotate: 45,
	},
	"bottom-right": {
		anchorClassName: "bottom-0 right-0",
		hiddenX: 88,
		hiddenY: 88,
		peekX: 42,
		peekY: 42,
		rotate: -45,
	},
	"top-left": {
		anchorClassName: "left-0 top-0",
		hiddenX: -88,
		hiddenY: -88,
		peekX: -42,
		peekY: -42,
		rotate: 135,
	},
	"top-right": {
		anchorClassName: "right-0 top-0",
		hiddenX: 88,
		hiddenY: -88,
		peekX: 42,
		peekY: -42,
		rotate: -135,
	},
} as const;

export namespace CornerPortraitPeek {
	export type Corner = keyof typeof cornerPresentation;
}

/** Keeps all portraits mounted in one corner and lets a random one peek inward. */
export const CornerPortraitPeek = ({
	active,
	corner,
}: {
	readonly active: boolean;
	readonly corner: CornerPortraitPeek.Corner;
}) => {
	const activePortraitIndex = useCornerPortraitPeek(active);
	const presentation = cornerPresentation[corner];

	return (
		<div
			className={`absolute z-20 ${presentation.anchorClassName} size-24`}
			data-corner={corner}
			data-ui="CornerPortraitPeek"
		>
			{AboutPortraitAssets.map((portraitUrl, portraitIndex) => {
				const visible = activePortraitIndex === portraitIndex;
				return (
					<motion.div
						animate={{
							opacity: visible ? 0.96 : 0,
							rotate: presentation.rotate,
							scale: visible ? 1 : 0.88,
							x: visible ? presentation.peekX : presentation.hiddenX,
							y: visible ? presentation.peekY : presentation.hiddenY,
						}}
						className="absolute inset-0 overflow-hidden rounded-full border-2 border-line-strong bg-surface-raised shadow-2xl will-change-transform"
						data-ui="CornerPortraitPeekPortrait"
						initial={false}
						key={portraitUrl}
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
			})}
		</div>
	);
};
