import { LauncherHeroAsset } from "~/ui/launcher/LauncherHeroAsset";

const viewTransitionName = "arkini-launcher-hero";
const heroAspectRatio = "3345 / 1882";
const compactWidth = "min(76vw, 48rem, 60.4304vh)";
const fullWidth = "min(88vw, 68rem, 103.0872vh)";

export namespace LauncherHero {
	export interface Props {
		readonly compact?: boolean;
	}
}

/** Renders one stable, decoded Hero paint surface for native View Transition handoff. */
export const LauncherHero = ({ compact = false }: LauncherHero.Props) => (
	<div
		role="img"
		aria-label="Arkini"
		className="block shrink-0 bg-contain bg-center bg-no-repeat drop-shadow-2xl"
		data-ui="LauncherHero"
		style={{
			aspectRatio: heroAspectRatio,
			backgroundImage: `url(${JSON.stringify(LauncherHeroAsset.url)})`,
			viewTransitionName,
			width: compact ? compactWidth : fullWidth,
		}}
	/>
);
