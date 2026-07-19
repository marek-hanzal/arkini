import type { PropsWithChildren } from "react";
import { twMerge } from "tailwind-merge";
import { LauncherScene } from "~/ui/launcher/LauncherScene";
import { mainPagePanelViewTransitionName } from "~/ui/navigation/mainPagePanelViewTransitionName";
import { routeSceneViewTransitionName } from "~/ui/navigation/routeSceneViewTransitionName";

const panelModeClassNames = {
	compact: "max-h-full w-full max-w-sm overflow-y-auto p-[var(--ak-panel-padding)]",
	responsive: "max-h-full w-full max-w-xl overflow-y-auto p-[var(--ak-panel-padding)]",
	viewport: "size-full max-w-5xl overflow-hidden p-[var(--ak-panel-padding)]",
} as const;

export namespace MainPageLayout {
	export type Page = "about" | "arkpacks" | "main-menu" | "settings";
	export type PanelMode = keyof typeof panelModeClassNames;

	export interface Props extends PropsWithChildren {
		readonly labelledBy?: string;
		readonly page: Page;
		readonly panelClassName?: string;
		readonly panelMode?: PanelMode;
		readonly transitionPanel?: boolean;
	}
}

/** Normalizes only the top-level destinations owned by the main menu. */
export const MainPageLayout = ({
	children,
	labelledBy,
	page,
	panelClassName,
	panelMode = "responsive",
	transitionPanel = true,
}: MainPageLayout.Props) => (
	<LauncherScene
		compactHero
		dataUi="MainPageLayout"
		layout="fixed-hero"
		viewTransitionName={routeSceneViewTransitionName}
	>
		<section
			aria-labelledby={labelledBy}
			className={twMerge(
				"min-h-0 min-w-0 rounded-2xl border border-line bg-surface/85 text-foreground shadow-2xl outline-none backdrop-blur-xl",
				panelModeClassNames[panelMode],
				panelClassName,
			)}
			data-page={page}
			data-ui="MainPagePanel"
			tabIndex={-1}
			style={
				transitionPanel
					? {
							viewTransitionName: mainPagePanelViewTransitionName,
						}
					: undefined
			}
		>
			{children}
		</section>
	</LauncherScene>
);
