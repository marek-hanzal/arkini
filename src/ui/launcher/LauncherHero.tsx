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

/** Renders stable Hero artwork with a cheap shadow layer outside shared-element geometry. */
export const LauncherHero = ({ compact = false }: LauncherHero.Props) => (
	<div
		className="relative block shrink-0 isolation-isolate"
		data-ui="LauncherHero"
		style={{
			aspectRatio: heroAspectRatio,
			width: compact ? compactWidth : fullWidth,
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
				viewTransitionName,
			}}
		/>
	</div>
);
