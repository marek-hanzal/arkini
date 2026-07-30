import { useEffect, useState, type MouseEventHandler, type PropsWithChildren } from "react";
import { useRouter } from "@tanstack/react-router";

import { useEditorProject } from "~/bridge/editor/useEditorProject";
import { ButtonLink, PrimaryButtonLink } from "~/ui/button/Button";

const tabClassName =
	"min-h-0 border-transparent bg-transparent px-3 py-2 text-sm shadow-none hover:bg-surface-raised";
const activeTabProps = {
	className: "border-accent bg-accent text-accent-contrast hover:bg-accent-hover",
} as const;
const inactiveTabProps = {} as const;
type EditorTab = "board" | "build" | "editor" | "project";

/** Keeps editor-wide navigation stable while child tools replace only the content surface. */
export const EditorShell = ({ children }: PropsWithChildren) => {
	const project = useEditorProject();
	const router = useRouter();
	const [optimisticTab, setOptimisticTab] = useState<EditorTab>();
	const params = {
		projectId: project.projectId,
	};
	useEffect(
		() =>
			router.subscribe("onResolved", () => {
				setOptimisticTab(undefined);
			}),
		[
			router,
		],
	);
	const readTabClassName = (tab: EditorTab) =>
		optimisticTab === tab ? `${tabClassName} ${activeTabProps.className}` : tabClassName;
	const readActiveTabProps = () =>
		optimisticTab === undefined ? activeTabProps : inactiveTabProps;
	const createTabClickHandler =
		(tab: EditorTab): MouseEventHandler<HTMLAnchorElement> =>
		(event) => {
			if (
				event.defaultPrevented ||
				event.button !== 0 ||
				event.metaKey ||
				event.altKey ||
				event.ctrlKey ||
				event.shiftKey
			) {
				return;
			}
			setOptimisticTab(tab);
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
						className={readTabClassName("editor")}
						activeProps={readActiveTabProps()}
						onClick={createTabClickHandler("editor")}
					>
						Editor
					</ButtonLink>
					<ButtonLink
						to="/editor/$projectId/project"
						params={params}
						className={readTabClassName("project")}
						activeProps={readActiveTabProps()}
						onClick={createTabClickHandler("project")}
					>
						Project
					</ButtonLink>
					<ButtonLink
						to="/editor/$projectId/build"
						params={params}
						className={readTabClassName("build")}
						activeProps={readActiveTabProps()}
						onClick={createTabClickHandler("build")}
					>
						Build
					</ButtonLink>
					<ButtonLink
						to="/editor/$projectId/board"
						params={params}
						className={readTabClassName("board")}
						activeProps={readActiveTabProps()}
						onClick={createTabClickHandler("board")}
					>
						Board
					</ButtonLink>
				</nav>
				<p className="min-w-0 flex-1 truncate px-2 text-right text-xs text-muted">
					{project.title}
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
