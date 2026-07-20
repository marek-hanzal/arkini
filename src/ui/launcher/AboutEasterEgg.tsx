import { useRef } from "react";
import { CornerPortraitPeek } from "~/ui/launcher/CornerPortraitPeek";
import { FallingPortrait } from "~/ui/launcher/FallingPortrait";
import { useAboutEasterEggDelay } from "~/ui/launcher/useAboutEasterEggDelay";

const fallingPortraitPool = Array.from(
	{
		length: 8,
	},
	(_, index) => ({
		id: `falling-portrait-${index}`,
		initialDelayMs: index * 1_500,
	}),
);

const corners = [
	"top-left",
	"top-right",
	"bottom-left",
	"bottom-right",
] as const satisfies readonly CornerPortraitPeek.Corner[];

/** Renders the delayed About-page portrait easter egg without replacing its stable DOM pool. */
export const AboutEasterEgg = () => {
	const active = useAboutEasterEggDelay();
	const containerRef = useRef<HTMLDivElement>(null);

	return (
		<div
			aria-hidden="true"
			className="pointer-events-none relative size-full overflow-hidden"
			data-active={active ? "true" : "false"}
			data-ui="AboutEasterEgg"
			ref={containerRef}
		>
			{fallingPortraitPool.map(({ id, initialDelayMs }) => (
				<FallingPortrait
					active={active}
					containerRef={containerRef}
					initialDelayMs={initialDelayMs}
					key={id}
				/>
			))}
			{corners.map((corner) => (
				<CornerPortraitPeek
					active={active}
					corner={corner}
					key={corner}
				/>
			))}
		</div>
	);
};
