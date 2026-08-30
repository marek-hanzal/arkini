import { useAtomSet } from "@effect/atom-react";
import { formatForDisplay, useHotkeys } from "@tanstack/react-hotkeys";
import { useBlocker, useRouter } from "@tanstack/react-router";
import { Effect } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";
import { LogOut, RefreshCw } from "lucide-react";
import {
	useCallback,
	useEffect,
	Fragment,
	useState,
	useSyncExternalStore,
	type PropsWithChildren,
} from "react";
import { flushSync } from "react-dom";

import { EditorProjectRepository } from "~/project-authoring/service/EditorProjectRepository";
import { ArkpackCatalogOwnerAtom } from "~/arkpack/renderer/ArkpackCatalogOwnerAtom";
import { RendererRuntime } from "~/application-runtime/service/RendererRuntime";
import { useEditorProject } from "~/authoring-session/ui/useEditorProject";
import { Button, ButtonLink, DangerButton, PrimaryButton } from "~/ui/button/Button";
import {
	EditorWorkspaceRoutes,
	type EditorWorkspaceId,
	useEditorActiveWorkspace,
} from "~/authoring-shell/ui/useEditorActiveWorkspace";
import { Tooltip } from "~/ui/overlay/Tooltip";
import { useOverlayFocus } from "~/ui/focus/useOverlayFocus";
import { readDataUiFn } from "~/ui/fn/readDataUiFn";
import { useEditorProjectRefreshController } from "~/authoring-session/ui/useEditorProjectRefreshController";
import { useEditorUnsavedChangesOwner } from "~/authoring-session/ui/useEditorUnsavedChangesRegistration";

const tabClassName =
	"ak-editor-workspace-tab size-11 min-h-0 shrink-0 border-transparent bg-transparent p-0 shadow-none transition-none hover:bg-surface-raised";

const waitForEditorProjectWritesCommandAtom = RendererRuntime.runSync(
	Effect.map(EditorProjectRepository, (repository) =>
		Atom.fn((_, get) => {
			const catalog = get(ArkpackCatalogOwnerAtom);
			return Effect.all([
				repository.awaitIdleFx,
				catalog?.awaitIdleFx ?? Effect.void,
			]).pipe(Effect.asVoid);
		}).pipe(Atom.setIdleTTL(0)),
	),
);

const readWorkspaceFromPathname = (
	pathname: string,
	projectId: string,
): EditorWorkspaceId | undefined =>
	EditorWorkspaceRoutes.find(({ matchTo }) => {
		const workspacePath = matchTo.replace("$projectId", projectId);
		return pathname === workspacePath || pathname.startsWith(`${workspacePath}/`);
	})?.id;

const useEditorWorkspaceShortcuts = ({
	enabled,
	projectId,
}: {
	readonly enabled: boolean;
	readonly projectId: string;
}) => {
	const router = useRouter();
	useHotkeys(
		EditorWorkspaceRoutes.map(({ shortcut, to }) => ({
			hotkey: shortcut,
			callback: (event) => {
				if (event.repeat) return;
				void router.navigate({
					to,
					params: {
						projectId,
					},
				});
			},
		})),
		{
			enabled,
			ignoreInputs: true,
			preventDefault: true,
			stopPropagation: true,
		},
	);
};

const EditorUnsavedChangesPrompt = ({
	state,
}: {
	readonly state: ReturnType<ReturnType<typeof useEditorUnsavedChangesOwner>["getSnapshot"]>;
}) => {
	const owner = useEditorUnsavedChangesOwner();
	const focus = useOverlayFocus({
		onClose: () => void owner.decide("cancel"),
	});
	return (
		<div className="fixed inset-0 z-[100] grid place-items-center bg-overlay/95 p-[var(--ak-viewport-padding)]">
			<div
				ref={focus.overlayRef}
				className="w-full max-w-md rounded-2xl border border-line-strong bg-surface-raised p-6 text-foreground shadow-2xl"
				data-ui="EditorUnsavedChangesDialog"
				onKeyDown={focus.onKeyDown}
			>
				<h2 className="text-lg font-semibold">Unsaved changes</h2>
				<p className="mt-2 text-sm leading-6 text-muted">
					{state.canSave
						? "Save or discard this draft before leaving the editor surface."
						: "This draft is invalid. Discard it or stay here and fix the highlighted fields."}
				</p>
				{state.error === undefined ? null : (
					<p className="mt-3 rounded-lg border border-danger/40 bg-danger/10 p-3 text-sm text-danger">
						{state.error instanceof Error ? state.error.message : String(state.error)}
					</p>
				)}
				<div className="mt-6 flex justify-end gap-2">
					<Button
						disabled={state.saving}
						onClick={() => void owner.decide("cancel")}
					>
						Cancel
					</Button>
					<DangerButton
						disabled={state.saving}
						onClick={() => void owner.decide("discard")}
					>
						Discard
					</DangerButton>
					{state.canSave ? (
						<PrimaryButton
							disabled={state.saving}
							cursorIntent={state.saving ? "progress" : undefined}
							onClick={() => void owner.decide("save")}
						>
							Save
						</PrimaryButton>
					) : null}
				</div>
			</div>
		</div>
	);
};

const EditorUnsavedChangesDialog = () => {
	const owner = useEditorUnsavedChangesOwner();
	const state = useSyncExternalStore(owner.subscribe, owner.getSnapshot, owner.getSnapshot);
	return state.promptOpen ? <EditorUnsavedChangesPrompt state={state} /> : null;
};

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
	const refresh = useEditorProjectRefreshController({
		blocked: exitPending,
		projectId: project.projectId,
	});
	const [transitioningWorkspace, setTransitioningWorkspace] = useState<EditorWorkspaceId>();
	const params = {
		projectId: project.projectId,
	};
	const unsavedChanges = useSyncExternalStore(
		unsavedChangesOwner.subscribe,
		unsavedChangesOwner.getSnapshot,
		unsavedChangesOwner.getSnapshot,
	);
	useEditorWorkspaceShortcuts({
		enabled: !exitPending && !refresh.pending && !unsavedChanges.promptOpen,
		projectId: project.projectId,
	});
	useBlocker({
		disabled: !unsavedChanges.hasDirtySession,
		enableBeforeUnload: false,
		shouldBlockFn: async ({ next }) => !(await unsavedChangesOwner.requestLeave(next.pathname)),
	});

	useEffect(() => window.arkini.lifecycle.onCloseFailed(() => setExitPending(false)), []);
	useEffect(() => {
		const unsubscribeBeforeNavigate = router.subscribe("onBeforeNavigate", ({ toLocation }) =>
			flushSync(() =>
				setTransitioningWorkspace(
					readWorkspaceFromPathname(toLocation.pathname, project.projectId),
				),
			),
		);
		const unsubscribeResolved = router.subscribe("onResolved", () =>
			setTransitioningWorkspace(undefined),
		);
		return () => {
			unsubscribeBeforeNavigate();
			unsubscribeResolved();
		};
	}, [
		project.projectId,
		router,
	]);
	const closeAndExit = useCallback(async () => {
		if (exitPending || refresh.pending) return;
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
		refresh.pending,
		router,
		unsavedChangesOwner,
		waitForProjectWrites,
	]);
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
				<nav className="ak-editor-workspace-tabs flex min-h-0 flex-col items-center gap-1">
					{EditorWorkspaceRoutes.map((workspace) => {
						if ("hiddenFromNavigation" in workspace) return null;
						const { icon: Icon, id, label, shortcut, to } = workspace;
						return (
							<Fragment key={id}>
								<Tooltip
									content={`${label} · ${formatForDisplay(shortcut)}`}
									placement="right"
								>
									<ButtonLink
										to={to}
										params={params}
										className={tabClassName}
										data-workspace-id={id}
										{...readDataUiFn({
											dataUi: "EditorWorkspaceTab",
											state: {
												current: activeWorkspace === id,
												transitioning: transitioningWorkspace === id,
											},
										})}
									>
										<Icon className="size-5" />
									</ButtonLink>
								</Tooltip>
								{"separatorAfter" in workspace ? (
									<div className="my-1 h-px w-8 shrink-0 bg-line" />
								) : null}
							</Fragment>
						);
					})}
				</nav>
				<Tooltip
					content={refresh.tooltip}
					placement="right"
				>
					<Button
						className="mt-auto size-11 min-h-0 shrink-0 border-transparent bg-transparent p-0 shadow-none hover:border-transparent hover:bg-surface-raised"
						data-ui="EditorProjectRefresh"
						disabled={refresh.disabled}
						cursorIntent={refresh.pending ? "progress" : undefined}
						onClick={refresh.refresh}
					>
						<RefreshCw className="size-5" />
					</Button>
				</Tooltip>
				<Tooltip
					content="Exit"
					placement="right"
				>
					<Button
						className="size-11 min-h-0 shrink-0 border-transparent bg-transparent p-0 shadow-none hover:border-transparent hover:bg-surface-raised"
						data-ui="EditorExit"
						disabled={exitPending || refresh.pending}
						cursorIntent={exitPending ? "progress" : undefined}
						onClick={() => void closeAndExit()}
					>
						<LogOut className="size-5" />
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
