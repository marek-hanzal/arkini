import type { CSSProperties } from "react";
import { LauncherHeroAsset } from "~/ui/launcher/LauncherHeroAsset";
import { launcherHeroArtworkViewTransitionName } from "~/ui/navigation/launcherHeroArtworkViewTransitionName";
import { launcherHeroShadowViewTransitionName } from "~/ui/navigation/launcherHeroShadowViewTransitionName";

const heroAspectRatio = "3345 / 1882";
const compactWidth = "var(--ak-compact-hero-width)";
const fullWidth = "var(--ak-full-hero-width)";

export namespace LauncherHero {
	export interface Props {
		readonly compact?: boolean;
		readonly style?: CSSProperties;
	}
}

/** Renders independently named transparent Hero layers for native shared-element motion. */
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
			style={{
				viewTransitionName: launcherHeroShadowViewTransitionName,
			}}
		/>
		<img
			src={LauncherHeroAsset.url}
			alt="Arkini"
			className="absolute inset-0 z-10 size-full object-contain"
			data-ui="LauncherHeroArtwork"
			draggable={false}
			style={{
				viewTransitionName: launcherHeroArtworkViewTransitionName,
			}}
		/>
	</div>
);
