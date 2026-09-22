import type { PropsWithChildren, ReactNode } from "react";
import { LauncherScene } from "~/launcher/ui/LauncherScene";

const launcherPagePresentation = {
	about: {
		content: "max-h-full overflow-y-auto p-[var(--ak-panel-padding)]",
		layout: "fixed-hero",
		panel: "max-h-full w-full max-w-xl overflow-hidden border border-line bg-surface shadow-2xl",
		viewTransitionName: "serakki-panel-about",
	},
	serapacks: {
		content: "flex min-h-0 flex-col overflow-hidden p-[var(--ak-panel-padding)]",
		layout: "fixed-hero",
		panel: "flex max-h-full w-full max-w-5xl flex-col overflow-hidden border border-line bg-surface shadow-2xl",
		viewTransitionName: "serakki-panel-serapacks",
	},
	"main-menu": {
		content: "max-h-full overflow-y-auto p-[var(--ak-panel-padding)]",
		layout: "fixed-hero",
		panel: "-mt-[5cqh] z-10 max-h-[calc(100%+5cqh)] w-full max-w-sm overflow-hidden border border-line/20 bg-surface/20 shadow-lg",
		viewTransitionName: "serakki-panel-main-menu",
	},
	settings: {
		content: "h-full max-h-full overflow-y-auto p-[var(--ak-panel-padding)]",
		layout: "overlaid-hero",
		panel: "h-full max-h-full w-full max-w-xl overflow-hidden border border-line bg-surface shadow-2xl",
		viewTransitionName: "serakki-panel-settings",
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
