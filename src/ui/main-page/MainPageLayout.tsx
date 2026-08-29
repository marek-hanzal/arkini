import type { PropsWithChildren, ReactNode } from "react";
import { LauncherScene } from "~/ui/launcher/LauncherScene";
import { mainPagePanelViewTransitionNameFn } from "~/ui/main-page/fn/mainPagePanelViewTransitionNameFn";

const MainPagePresentation = {
	about: {
		content: "max-h-full overflow-y-auto p-[var(--ak-panel-padding)]",
		layout: "fixed-hero",
		panel: "max-h-full w-full max-w-xl overflow-hidden border border-line bg-surface shadow-2xl",
	},
	arkpacks: {
		content: "size-full overflow-hidden p-[var(--ak-panel-padding)]",
		layout: "fixed-hero",
		panel: "size-full max-w-5xl overflow-hidden border border-line bg-surface shadow-2xl",
	},
	"editor-welcome": {
		content: "max-h-full overflow-y-auto p-[var(--ak-panel-padding)]",
		layout: "fixed-hero",
		panel: "max-h-full w-full max-w-5xl overflow-hidden border border-line bg-surface shadow-2xl",
	},
	"main-menu": {
		content: "max-h-full overflow-y-auto p-[var(--ak-panel-padding)]",
		layout: "fixed-hero",
		panel: "max-h-full w-full max-w-sm overflow-visible border-0 border-line bg-transparent shadow-none",
	},
	settings: {
		content: "h-full max-h-full overflow-y-auto p-[var(--ak-panel-padding)]",
		layout: "overlaid-hero",
		panel: "h-full max-h-full w-full max-w-xl overflow-hidden border border-line bg-surface shadow-2xl",
	},
} as const;

type MainPage = keyof typeof MainPagePresentation;

export namespace MainPageLayout {
	export interface Props extends PropsWithChildren {
		readonly foregroundOverlay?: ReactNode;
		readonly labelledBy?: string;
		readonly overlay?: ReactNode;
		readonly page: MainPage;
	}
}

/** Normalizes launcher leaves around one shared Hero and one explicit content surface. */
export const MainPageLayout = ({
	children,
	foregroundOverlay,
	labelledBy,
	overlay,
	page,
}: MainPageLayout.Props) => {
	const presentation = MainPagePresentation[page];
	return (
		<LauncherScene
			compactHero
			dataUi="MainPageLayout"
			foregroundOverlay={foregroundOverlay}
			layout={presentation.layout}
			overlay={overlay}
		>
			<section
				aria-labelledby={labelledBy}
				className={`relative min-h-0 min-w-0 rounded-2xl text-foreground outline-none ${presentation.panel}`}
				data-page={page}
				data-ui="MainPagePanel"
				tabIndex={-1}
				style={{
					viewTransitionName: mainPagePanelViewTransitionNameFn(page),
				}}
			>
				<div
					className={`relative z-10 min-h-0 min-w-0 ${presentation.content}`}
					data-ui="MainPagePanelContent"
				>
					{children}
				</div>
			</section>
		</LauncherScene>
	);
};
