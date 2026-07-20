import { motion } from "motion/react";
import type { RefObject } from "react";
import { useFallingPortraitMotion } from "~/ui/launcher/useFallingPortraitMotion";

/** Renders one stable portrait ball from the recycled About-page falling pool. */
export const FallingPortrait = ({
	active,
	containerRef,
	initialDelayMs,
}: {
	readonly active: boolean;
	readonly containerRef: RefObject<HTMLDivElement | null>;
	readonly initialDelayMs: number;
}) => {
	const { appearance, controls } = useFallingPortraitMotion({
		active,
		containerRef,
		initialDelayMs,
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
