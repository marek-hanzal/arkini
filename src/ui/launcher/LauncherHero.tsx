import type { CSSProperties } from "react";
import { LauncherHeroAsset } from "~/ui/launcher/LauncherHeroAsset";

const heroAspectRatio = "3345 / 1882";
const compactWidth = "var(--ak-compact-hero-width)";
const fullWidth = "var(--ak-full-hero-width)";

export namespace LauncherHero {
	export interface Props {
		readonly compact?: boolean;
		readonly style?: CSSProperties;
	}
}

/** Renders the normal-DOM Hero composite without a nested View Transition snapshot. */
export const LauncherHero = ({ compact = false, style }: LauncherHero.Props) => (
	<div
		className="relative block shrink-0 isolation-isolate"
		data-ui="LauncherHero"
		style={{
			aspectRatio: heroAspectRatio,
			width: compact ? compactWidth : fullWidth,
			...style,
		}}
	>
		<div
			className="launcher-hero__shadow pointer-events-none absolute inset-x-[8%] bottom-[-4%] h-[28%]"
			aria-hidden="true"
			data-ui="LauncherHeroShadow"
		/>
		<div
			role="img"
			aria-label="Arkini"
			className="absolute inset-0 z-10 bg-contain bg-center bg-no-repeat"
			data-ui="LauncherHeroArtwork"
			style={{
				backgroundImage: `url(${JSON.stringify(LauncherHeroAsset.url)})`,
			}}
		/>
	</div>
);
