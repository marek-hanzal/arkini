import { type CSSProperties, use, useSyncExternalStore } from "react";
import { LauncherHeroAsset } from "~/ui/launcher/LauncherHeroAsset";
import { LauncherStartupContext } from "~/ui/launcher/LauncherStartupContext";
import { launcherHeroArtworkViewTransitionName } from "~/ui/navigation/launcherHeroArtworkViewTransitionName";
import { launcherHeroShadowViewTransitionName } from "~/ui/navigation/launcherHeroShadowViewTransitionName";

const heroAspectRatio = "1535 / 1024";
const compactWidth = "var(--ak-compact-hero-width)";
const fullWidth = "var(--ak-full-hero-width)";
const subscribeToFallback = () => () => undefined;
const readFallbackUrl = () => LauncherHeroAsset.url;

export namespace LauncherHero {
	export interface Props {
		readonly compact?: boolean;
		readonly style?: CSSProperties;
	}
}

/** Renders the launcher-owned Hero URL as independently named native transition layers. */
export const LauncherHero = ({ compact = false, style }: LauncherHero.Props) => {
	const startup = use(LauncherStartupContext);
	const heroUrl = useSyncExternalStore(
		startup?.subscribe ?? subscribeToFallback,
		startup?.getHeroUrl ?? readFallbackUrl,
		startup?.getHeroUrl ?? readFallbackUrl,
	);

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
