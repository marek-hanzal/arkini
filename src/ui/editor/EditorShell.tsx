import { useAtomSet } from "@effect/atom-react";
import { useRouter } from "@tanstack/react-router";
import { useCallback, useEffect, useState, type PropsWithChildren } from "react";

import { useEditorProject } from "~/bridge/editor/useEditorProject";
import { waitForEditorProjectWritesCommandAtom } from "~/bridge/editor/waitForEditorProjectWritesCommandAtom";
import { ButtonLink, PrimaryButton } from "~/ui/button/Button";
import {
	EditorWorkspaceRoutes,
	type EditorWorkspaceId,
	useEditorActiveWorkspace,
} from "~/ui/editor/useEditorActiveWorkspace";

const tabClassName =
	"ak-editor-workspace-tab min-h-0 border-transparent bg-transparent px-3 py-2 text-sm shadow-none transition-none hover:bg-surface-raised";
const activeTabProps = {
	className: "border-accent bg-accent text-accent-contrast hover:bg-accent-hover",
} as const;

/** Keeps editor-wide navigation stable while child tools replace only the content surface. */
export const EditorShell = ({ children }: PropsWithChildren) => {
	const project = useEditorProject();
	const router = useRouter();
	const waitForProjectWrites = useAtomSet(waitForEditorProjectWritesCommandAtom, {
		mode: "promise",
	});
	const activeWorkspace = useEditorActiveWorkspace(project.projectId);
	const [exitPending, setExitPending] = useState(false);
	const params = {
		projectId: project.projectId,
	};

	useEffect(() => window.arkini.lifecycle.onCloseFailed(() => setExitPending(false)), []);
	const closeAndExit = useCallback(async () => {
		if (exitPending) return;
		setExitPending(true);
		try {
			await waitForProjectWrites(undefined);
			await router.navigate({
				to: "/main-menu",
			});
		} catch {
			setExitPending(false);
		}
	}, [
		exitPending,
		router,
		waitForProjectWrites,
	]);
	const readTabProps = (workspace: EditorWorkspaceId) =>
		activeWorkspace === workspace
			? {
					"aria-current": "page" as const,
					className: `${tabClassName} ${activeTabProps.className}`,
				}
			: {
					className: tabClassName,
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
				className="relative z-20 flex min-w-0 flex-wrap items-center gap-2 border-b border-line bg-surface/95 px-[var(--ak-viewport-padding)] py-3 shadow-lg"
				data-ui="EditorNavigation"
				style={{
					viewTransitionName: "arkini-editor-navigation",
				}}
			>
				<nav
					className="ak-editor-workspace-tabs flex min-w-0 flex-wrap items-center gap-1"
					aria-label="Editor tools"
				>
					{EditorWorkspaceRoutes.map(({ id, label, to }) => (
						<ButtonLink
							key={id}
							to={to}
							params={params}
							{...readTabProps(id)}
						>
							{label}
						</ButtonLink>
					))}
				</nav>
				<p className="min-w-0 flex-1 truncate px-2 text-right text-xs text-muted">
					{project.title}
				</p>
				<PrimaryButton
					className="min-h-0 shrink-0 px-4 py-2 text-sm"
					disabled={exitPending}
					cursorIntent={exitPending ? "progress" : undefined}
					onClick={() => void closeAndExit()}
				>
					{exitPending ? "Exiting…" : "Exit"}
				</PrimaryButton>
			</header>
			<main
				className="min-h-0 min-w-0 overflow-hidden px-[var(--ak-viewport-padding)] py-[var(--ak-viewport-gap)]"
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
