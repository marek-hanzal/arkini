import type { PropsWithChildren } from "react";

import { useEditorProject } from "~/bridge/editor/useEditorProject";
import { ButtonLink, PrimaryButtonLink } from "~/ui/button/Button";

const tabClassName =
	"min-h-0 border-transparent bg-transparent px-3 py-2 text-sm shadow-none hover:bg-surface-raised";
const activeTabProps = {
	className: "border-accent bg-accent text-accent-contrast hover:bg-accent-hover",
} as const;

/** Keeps editor-wide navigation stable while child tools replace only the content surface. */
export const EditorShell = ({ children }: PropsWithChildren) => {
	const project = useEditorProject();
	const params = {
		projectId: project.projectId,
	};
	return (
		<div
			className="grid h-dvh min-h-0 grid-rows-[auto_minmax(0,1fr)] overflow-hidden bg-[var(--ak-game-shell-background)] text-foreground"
			data-ui="EditorShell"
			style={{
				viewTransitionName: "arkini-editor-shell",
			}}
		>
			<header
				className="relative z-20 flex min-w-0 flex-wrap items-center gap-2 border-b border-line bg-surface/95 px-[var(--ak-viewport-padding)] py-3 shadow-lg backdrop-blur-xl"
				data-ui="EditorNavigation"
				style={{
					viewTransitionName: "arkini-editor-navigation",
				}}
			>
				<nav
					className="flex min-w-0 flex-wrap items-center gap-1"
					aria-label="Editor tools"
				>
					<ButtonLink
						to="/editor/$projectId/editor"
						params={params}
						className={tabClassName}
						activeProps={activeTabProps}
					>
						Editor
					</ButtonLink>
					<ButtonLink
						to="/editor/$projectId/project"
						params={params}
						className={tabClassName}
						activeProps={activeTabProps}
					>
						Project
					</ButtonLink>
					<ButtonLink
						to="/editor/$projectId/build"
						params={params}
						className={tabClassName}
						activeProps={activeTabProps}
					>
						Build
					</ButtonLink>
					<ButtonLink
						to="/editor/$projectId/board"
						params={params}
						className={tabClassName}
						activeProps={activeTabProps}
					>
						Board
					</ButtonLink>
				</nav>
				<p className="min-w-0 flex-1 truncate px-2 text-right text-xs text-muted">
					{project.title} · {project.config?.version ?? project.game ?? "New project"}
				</p>
				<PrimaryButtonLink
					to="/main-menu"
					className="min-h-0 shrink-0 px-4 py-2 text-sm"
				>
					Save &amp; exit
				</PrimaryButtonLink>
			</header>
			<main
				className="min-h-0 min-w-0 overflow-hidden p-[var(--ak-viewport-padding)]"
				data-ui="EditorContent"
				style={{
					viewTransitionName: "arkini-editor-content",
				}}
			>
				{children}
			</main>
		</div>
	);
};
