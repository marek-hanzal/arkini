import type { MouseEventHandler, PropsWithChildren, ReactNode } from "react";
import { CursorClassName, type CursorSemantic } from "~/ui/cursor/CursorSemantic";
import { LauncherHero } from "~/ui/launcher/LauncherHero";
import { RouteBackdrop } from "~/ui/navigation/RouteBackdrop";

const layoutClassNames = {
	centered:
		"flex size-full min-h-0 min-w-0 flex-col items-center justify-center gap-[var(--ak-viewport-gap)]",
	"fixed-hero":
		"grid size-full min-h-0 min-w-0 justify-items-center gap-[var(--ak-viewport-gap)]",
	"overlaid-hero": "grid size-full min-h-0 min-w-0 justify-items-center",
} as const;

const heroSlotClassNames = {
	centered: "flex shrink-0 items-center justify-center",
	"fixed-hero": "flex min-h-0 w-full items-end justify-center",
	"overlaid-hero": "col-start-1 row-start-1 flex min-h-0 w-full items-start justify-center",
} as const;

const contentSlotClassNames = {
	centered: "flex min-h-0 min-w-0 flex-col items-center justify-center",
	"fixed-hero": "flex size-full min-h-0 min-w-0 flex-col items-center justify-start",
	"overlaid-hero":
		"relative z-10 col-start-1 row-start-1 flex size-full min-h-0 min-w-0 flex-col items-center justify-start",
} as const;

type LauncherSceneLayout = keyof typeof layoutClassNames;

export namespace LauncherScene {
	export interface Props extends PropsWithChildren {
		readonly compactHero?: boolean;
		readonly cursor?: Extract<CursorSemantic, "default" | "wait">;
		readonly dataUi: string;
		readonly foregroundOverlay?: ReactNode;
		readonly layout?: LauncherSceneLayout;
		readonly onClick?: MouseEventHandler<HTMLElement>;
		readonly overlay?: ReactNode;
	}
}

/** Shared launcher/action composition with independently animated visual primitives. */
export const LauncherScene = ({
	children,
	compactHero = false,
	cursor,
	dataUi,
	foregroundOverlay,
	layout = "centered",
	onClick,
	overlay,
}: LauncherScene.Props) => (
	<main
		className={`launcher-scene relative size-full min-h-0 min-w-0 overflow-hidden bg-canvas text-foreground${cursor === undefined ? "" : ` ${CursorClassName[cursor]}`}`}
		data-ui={dataUi}
		onClick={onClick}
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
