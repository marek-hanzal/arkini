import { motion } from "motion/react";
import { useRef } from "react";
import { useAboutJumpscareMotion } from "~/ui/launcher/useAboutJumpscareMotion";

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
