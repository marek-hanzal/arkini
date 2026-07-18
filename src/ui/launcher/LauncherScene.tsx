import type { PropsWithChildren } from "react";
import { LauncherHero } from "~/ui/launcher/LauncherHero";

export namespace LauncherScene {
	export interface Props extends PropsWithChildren {
		readonly className?: string;
		readonly compactHero?: boolean;
		readonly dataUi: string;
		readonly viewTransitionName?: string;
	}
}

/** Shared theme-aware Hero composition for out-of-game launcher destinations. */
export const LauncherScene = ({
	children,
	className,
	compactHero = false,
	dataUi,
	viewTransitionName,
}: LauncherScene.Props) => (
	<main
		className={`launcher-scene relative size-full min-h-0 min-w-0 overflow-hidden bg-canvas text-foreground${className === undefined ? "" : ` ${className}`}`}
		data-ui={dataUi}
		style={{
			viewTransitionName,
		}}
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
			<LauncherHero compact={compactHero} />
			{children}
		</div>
	</main>
);
