import type { PropsWithChildren, ReactNode } from "react";
import { LauncherScene } from "~/launcher/ui/LauncherScene";

const launcherPagePresentation = {
	about: {
		content: "max-h-full overflow-y-auto p-[var(--ak-panel-padding)]",
		layout: "fixed-hero",
		panel: "max-h-full w-full max-w-xl overflow-hidden border border-line bg-surface shadow-2xl",
		viewTransitionName: "arkini-panel-about",
	},
	arkpacks: {
		content: "size-full overflow-hidden p-[var(--ak-panel-padding)]",
		layout: "fixed-hero",
		panel: "size-full max-w-5xl overflow-hidden border border-line bg-surface shadow-2xl",
		viewTransitionName: "arkini-panel-arkpacks",
	},
	"editor-welcome": {
		content: "max-h-full overflow-y-auto p-[var(--ak-panel-padding)]",
		layout: "fixed-hero",
		panel: "max-h-full w-full max-w-5xl overflow-hidden border border-line bg-surface shadow-2xl",
		viewTransitionName: "arkini-panel-editor-welcome",
	},
	"main-menu": {
		content: "max-h-full overflow-y-auto p-[var(--ak-panel-padding)]",
		layout: "fixed-hero",
		panel: "max-h-full w-full max-w-sm overflow-visible border-0 border-line bg-transparent shadow-none",
		viewTransitionName: "arkini-panel-main-menu",
	},
	settings: {
		content: "h-full max-h-full overflow-y-auto p-[var(--ak-panel-padding)]",
		layout: "overlaid-hero",
		panel: "h-full max-h-full w-full max-w-xl overflow-hidden border border-line bg-surface shadow-2xl",
		viewTransitionName: "arkini-panel-settings",
	},
} as const;

type LauncherPage = keyof typeof launcherPagePresentation;

interface LauncherPageLayoutProps extends PropsWithChildren {
	readonly foregroundOverlay?: ReactNode;
	readonly overlay?: ReactNode;
	readonly page: LauncherPage;
}

/** Normalizes launcher leaves around one shared Hero and one explicit content surface. */
export const LauncherPageLayout = ({
	children,
	foregroundOverlay,
	overlay,
	page,
}: LauncherPageLayoutProps) => {
	const presentation = launcherPagePresentation[page];
	return (
		<LauncherScene
			compactHero
			dataUi="LauncherPageLayout"
			foregroundOverlay={foregroundOverlay}
			layout={presentation.layout}
			overlay={overlay}
		>
			<section
				className={`relative min-h-0 min-w-0 rounded-2xl text-foreground outline-none ${presentation.panel}`}
				data-page={page}
				data-ui="LauncherPagePanel"
				style={{
					viewTransitionName: presentation.viewTransitionName,
				}}
			>
				<div
					className={`relative z-10 min-h-0 min-w-0 ${presentation.content}`}
					data-ui="LauncherPagePanelContent"
				>
					{children}
				</div>
			</section>
		</LauncherScene>
	);
};
