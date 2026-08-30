import { useRef } from "react";
import { CornerPortraitPeek } from "~/launcher/ui/CornerPortraitPeek";
import { FallingPortrait } from "~/launcher/ui/FallingPortrait";

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
] as const;

/** Renders the delayed About-page portrait easter egg without replacing its stable DOM pool. */
export const AboutEasterEgg = ({
	active,
	portraitUrls,
}: {
	readonly active: boolean;
	readonly portraitUrls: readonly string[];
}) => {
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
					portraitUrls={portraitUrls}
					key={id}
				/>
			))}
			{corners.map((corner) => (
				<CornerPortraitPeek
					active={active}
					corner={corner}
					portraitUrls={portraitUrls}
					key={corner}
				/>
			))}
		</div>
	);
};
