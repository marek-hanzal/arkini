import type { PropsWithChildren } from "react";
import { LauncherHero } from "~/ui/launcher/LauncherHero";

const layoutClassNames = {
	centered:
		"flex size-full min-h-0 min-w-0 flex-col items-center justify-center gap-[var(--ak-viewport-gap)]",
	"fixed-hero":
		"grid size-full min-h-0 min-w-0 justify-items-center gap-[var(--ak-viewport-gap)]",
} as const;

const heroSlotClassNames = {
	centered: "flex shrink-0 items-center justify-center",
	"fixed-hero": "flex min-h-0 w-full items-end justify-center",
} as const;

const contentSlotClassNames = {
	centered: "flex min-h-0 min-w-0 flex-col items-center justify-center",
	"fixed-hero": "flex size-full min-h-0 min-w-0 flex-col items-center justify-start",
} as const;

export namespace LauncherScene {
	export type Layout = keyof typeof layoutClassNames;

	export interface Props extends PropsWithChildren {
		readonly className?: string;
		readonly compactHero?: boolean;
		readonly dataUi: string;
		readonly layout?: Layout;
		readonly viewTransitionName?: string;
	}
}

/** Shared theme-aware Hero composition for out-of-game launcher destinations. */
export const LauncherScene = ({
	children,
	className,
	compactHero = false,
	dataUi,
	layout = "centered",
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
		<div
			className={`relative z-10 overflow-hidden p-[var(--ak-viewport-padding)] ${layoutClassNames[layout]}`}
			data-layout={layout}
			data-ui="LauncherSceneLayout"
		>
			<div
				className={heroSlotClassNames[layout]}
				data-ui="LauncherSceneHeroSlot"
			>
				<LauncherHero compact={compactHero} />
			</div>
			<div
				className={contentSlotClassNames[layout]}
				data-ui="LauncherSceneContentSlot"
			>
				{children}
			</div>
		</div>
	</main>
);
