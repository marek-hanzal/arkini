import type { PropsWithChildren } from "react";
import { twMerge } from "tailwind-merge";
import { LauncherScene } from "~/ui/launcher/LauncherScene";
import { routeContentViewTransitionName } from "~/ui/navigation/routeContentViewTransitionName";

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
	}
}

/** Normalizes launcher leaves around one shared Hero and one explicit content surface. */
export const MainPageLayout = ({
	children,
	labelledBy,
	page,
	panelClassName,
	panelMode = "responsive",
}: MainPageLayout.Props) => (
	<LauncherScene
		compactHero
		dataUi="MainPageLayout"
		layout="fixed-hero"
	>
		<section
			aria-labelledby={labelledBy}
			className={twMerge(
				"min-h-0 min-w-0 rounded-2xl border border-line bg-surface text-foreground shadow-2xl outline-none",
				panelModeClassNames[panelMode],
				panelClassName,
			)}
			data-page={page}
			data-ui="MainPagePanel"
			tabIndex={-1}
			style={{
				viewTransitionName: routeContentViewTransitionName,
			}}
		>
			{children}
		</section>
	</LauncherScene>
);
