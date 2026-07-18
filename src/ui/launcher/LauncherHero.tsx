import { LauncherHeroAsset } from "~/ui/launcher/LauncherHeroAsset";

const viewTransitionName = "arkini-launcher-hero";

export namespace LauncherHero {
	export interface Props {
		readonly compact?: boolean;
		readonly eager?: boolean;
	}
}

/** Renders the shared Arkini Hero with one stable native View Transition identity. */
export const LauncherHero = ({ compact = false, eager = false }: LauncherHero.Props) => (
	<img
		src={LauncherHeroAsset.url}
		alt="Arkini"
		className={
			compact
				? "block max-h-[34vh] w-auto max-w-[min(76vw,48rem)] object-contain drop-shadow-2xl"
				: "block max-h-[58vh] w-auto max-w-[min(88vw,68rem)] object-contain drop-shadow-2xl"
		}
		data-ui="LauncherHero"
		decoding="sync"
		draggable={false}
		fetchPriority={eager ? "high" : undefined}
		loading={eager ? "eager" : undefined}
		style={{
			viewTransitionName,
		}}
	/>
);
