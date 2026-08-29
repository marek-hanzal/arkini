import { useAtomValue } from "@effect/atom-react";
import type { CSSProperties } from "react";
import { LauncherHeroUrlAtom } from "~/ui/launcher/LauncherHeroUrlAtom";

const heroAspectRatio = "1535 / 1024";
const compactWidth = "var(--ak-compact-hero-width)";
const fullWidth = "var(--ak-full-hero-width)";
const launcherHeroArtworkViewTransitionName = "arkini-launcher-hero-artwork";
const launcherHeroShadowViewTransitionName = "arkini-launcher-hero-shadow";

export namespace LauncherHero {
	export interface Props {
		readonly compact?: boolean;
		readonly style?: CSSProperties;
	}
}

/** Renders the launcher-owned Hero URL as independently named native transition layers. */
export const LauncherHero = ({ compact = false, style }: LauncherHero.Props) => {
	const heroUrl = useAtomValue(LauncherHeroUrlAtom);

	return (
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
				src={heroUrl}
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
};
