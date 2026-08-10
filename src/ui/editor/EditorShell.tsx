import { useAtomSet } from "@effect/atom-react";
import { useBlocker, useRouter } from "@tanstack/react-router";
import {
	useCallback,
	useEffect,
	useState,
	useSyncExternalStore,
	type PropsWithChildren,
} from "react";

import { useEditorProject } from "~/bridge/editor/useEditorProject";
import { waitForEditorProjectWritesCommandAtom } from "~/bridge/editor/waitForEditorProjectWritesCommandAtom";
import { Button, ButtonLink } from "~/ui/button/Button";
import {
	EditorWorkspaceRoutes,
	type EditorWorkspaceId,
	useEditorActiveWorkspace,
} from "~/ui/editor/useEditorActiveWorkspace";
import { Tooltip } from "~/ui/overlay/Tooltip";
import { EditorUnsavedChangesDialog } from "~/ui/editor/EditorUnsavedChangesDialog";
import { useEditorUnsavedChangesOwner } from "~/ui/editor/useEditorUnsavedChangesRegistration";

const tabClassName =
	"ak-editor-workspace-tab size-11 min-h-0 shrink-0 border-transparent bg-transparent p-0 shadow-none transition-none hover:bg-surface-raised";
const activeTabProps = {
	className: "border-accent bg-accent text-accent-contrast hover:bg-accent-hover",
} as const;

/** Keeps editor-wide navigation stable while child tools replace only the content surface. */
export const EditorShell = ({ children }: PropsWithChildren) => {
	const project = useEditorProject();
	const unsavedChangesOwner = useEditorUnsavedChangesOwner();
	const router = useRouter();
	const waitForProjectWrites = useAtomSet(waitForEditorProjectWritesCommandAtom, {
		mode: "promise",
	});
	const activeWorkspace = useEditorActiveWorkspace(project.projectId);
	const [exitPending, setExitPending] = useState(false);
	const params = {
		projectId: project.projectId,
	};
	const unsavedChanges = useSyncExternalStore(
		unsavedChangesOwner.subscribe,
		unsavedChangesOwner.getSnapshot,
		unsavedChangesOwner.getSnapshot,
	);
	useBlocker({
		disabled: !unsavedChanges.hasDirtySession,
		enableBeforeUnload: false,
		shouldBlockFn: async ({ next }) => !(await unsavedChangesOwner.requestLeave(next.pathname)),
	});

	useEffect(() => window.arkini.lifecycle.onCloseFailed(() => setExitPending(false)), []);
	const closeAndExit = useCallback(async () => {
		if (exitPending) return;
		setExitPending(true);
		try {
			if (!(await unsavedChangesOwner.requestLeave("/main-menu"))) {
				setExitPending(false);
				return;
			}
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
		unsavedChangesOwner,
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
			className="grid h-dvh min-h-0 grid-cols-[auto_minmax(0,1fr)] overflow-hidden bg-surface text-foreground"
			data-ui="EditorShell"
			style={{
				viewTransitionName: "arkini-editor-shell",
			}}
		>
			<aside
				className="relative z-20 flex min-h-0 w-16 flex-col items-center gap-2 border-r border-line bg-surface p-2 shadow-lg"
				data-ui="EditorNavigation"
				style={{
					viewTransitionName: "arkini-editor-navigation",
				}}
			>
				<nav
					className="ak-editor-workspace-tabs flex min-h-0 flex-col items-center gap-1"
					aria-label="Editor tools"
				>
					{EditorWorkspaceRoutes.map(({ icon, id, label, to }) => (
						<Tooltip
							key={id}
							content={label}
							placement="right"
						>
							<ButtonLink
								to={to}
								params={params}
								aria-label={label}
								data-workspace-id={id}
								{...readTabProps(id)}
							>
								<span className={`${icon} size-5`} />
							</ButtonLink>
						</Tooltip>
					))}
				</nav>
				<Tooltip
					content={exitPending ? "Exiting…" : "Exit"}
					placement="right"
				>
					<Button
						className="mt-auto size-11 min-h-0 shrink-0 border-transparent bg-transparent p-0 shadow-none hover:border-transparent hover:bg-surface-raised"
						data-ui="EditorExit"
						aria-label={exitPending ? "Exiting…" : "Exit"}
						disabled={exitPending}
						cursorIntent={exitPending ? "progress" : undefined}
						onClick={() => void closeAndExit()}
					>
						<span
							className={`${exitPending ? "icon-[lucide--loader-circle] animate-spin" : "icon-[lucide--log-out]"} size-5`}
						/>
					</Button>
				</Tooltip>
			</aside>
			<main
				className="min-h-0 min-w-0 overflow-hidden bg-surface"
				data-ui="EditorContent"
				style={{
					viewTransitionName: "arkini-editor-content",
				}}
			>
				{children}
			</main>
			<EditorUnsavedChangesDialog />
		</div>
	);
};
