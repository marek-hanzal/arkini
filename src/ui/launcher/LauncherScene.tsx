import type { PropsWithChildren } from "react";
import { LauncherHeroAsset } from "~/ui/launcher/LauncherHeroAsset";

export namespace LauncherScene {
	export interface Props extends PropsWithChildren {
		readonly compactHero?: boolean;
		readonly dataUi: string;
	}
}

/** Shared theme-aware Hero composition for out-of-game launcher destinations. */
export const LauncherScene = ({ children, compactHero = false, dataUi }: LauncherScene.Props) => (
	<main
		className="launcher-scene relative size-full min-h-0 min-w-0 overflow-hidden bg-canvas text-foreground"
		data-ui={dataUi}
	>
		<div
			className="launcher-scene__glow absolute inset-0"
			aria-hidden="true"
		/>
		<div
			className="launcher-scene__veil absolute inset-0"
			aria-hidden="true"
		/>
		<div className="relative z-10 flex size-full min-h-0 flex-col items-center justify-center gap-[clamp(1rem,3vmin,2rem)] overflow-hidden p-[clamp(1rem,4vmin,3rem)]">
			<img
				src={LauncherHeroAsset.url}
				alt="Arkini"
				className={
					compactHero
						? "max-h-[34vh] w-auto max-w-[min(76vw,48rem)] object-contain drop-shadow-2xl"
						: "max-h-[58vh] w-auto max-w-[min(88vw,68rem)] object-contain drop-shadow-2xl"
				}
				decoding="async"
				draggable={false}
			/>
			{children}
		</div>
	</main>
);
