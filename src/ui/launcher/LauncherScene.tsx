import type { PropsWithChildren, ReactNode } from "react";
import { LauncherHero } from "~/ui/launcher/LauncherHero";
import { RouteBackdrop } from "~/ui/navigation/RouteBackdrop";

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

type LauncherSceneLayout = keyof typeof layoutClassNames;

export namespace LauncherScene {
	export interface Props extends PropsWithChildren {
		readonly className?: string;
		readonly compactHero?: boolean;
		readonly dataUi: string;
		readonly foregroundOverlay?: ReactNode;
		readonly layout?: LauncherSceneLayout;
		readonly overlay?: ReactNode;
	}
}

/** Shared launcher/action composition with independently animated visual primitives. */
export const LauncherScene = ({
	children,
	className,
	compactHero = false,
	dataUi,
	foregroundOverlay,
	layout = "centered",
	overlay,
}: LauncherScene.Props) => (
	<main
		className={`launcher-scene relative size-full min-h-0 min-w-0 overflow-hidden bg-canvas text-foreground${className === undefined ? "" : ` ${className}`}`}
		data-ui={dataUi}
	>
		<RouteBackdrop
			className="launcher-scene__backdrop absolute inset-0"
			dataUi="LauncherSceneBackdrop"
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
		{overlay === undefined ? null : (
			<div
				className="pointer-events-none absolute inset-0 z-[5] overflow-hidden"
				data-ui="LauncherSceneOverlay"
			>
				{overlay}
			</div>
		)}
		{foregroundOverlay === undefined ? null : (
			<div
				className="pointer-events-none absolute inset-0 z-20 overflow-hidden"
				data-ui="LauncherSceneForegroundOverlay"
			>
				{foregroundOverlay}
			</div>
		)}
	</main>
);
