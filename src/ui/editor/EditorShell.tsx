import { RegistryContext, useAtomValue } from "@effect/atom-react";
import { useMutation } from "@tanstack/react-query";
import { useBlocker, useRouter } from "@tanstack/react-router";
import {
	useContext,
	useEffect,
	useState,
	type MouseEventHandler,
	type PropsWithChildren,
} from "react";

import { EditorProjectDraftAtom } from "~/bridge/editor/EditorProjectDraftAtom";
import { EditorProjectFormDirtyAtom } from "~/bridge/editor/EditorProjectFormDirtyAtom";
import { EditorProjectMutationPendingAtom } from "~/bridge/editor/EditorProjectMutationLane";
import {
	closeEditorProjectSessionFx,
	releaseEditorProjectSession,
	resumeEditorProjectSession,
} from "~/bridge/editor/EditorProjectSession";
import { persistEditorProjectMutationFx } from "~/bridge/editor/persistEditorProjectMutation";
import { RendererRuntime } from "~/bridge/runtime/RendererRuntime";
import { useEditorProject } from "~/bridge/editor/useEditorProject";
import { Button, ButtonLink, PrimaryButton } from "~/ui/button/Button";

const tabClassName =
	"min-h-0 border-transparent bg-transparent px-3 py-2 text-sm shadow-none hover:bg-surface-raised";
const activeTabProps = {
	className: "border-accent bg-accent text-accent-contrast hover:bg-accent-hover",
} as const;
const inactiveTabProps = {} as const;
type EditorTab = "assets" | "board" | "build" | "editor" | "project";
const readEditorTab = (pathname: string): EditorTab | undefined => {
	const match = pathname.match(/\/editor\/[^/]+\/(assets|board|build|editor|project)(?:\/|$)/);
	return match?.[1] as EditorTab | undefined;
};

/** Keeps editor-wide navigation stable while child tools replace only the content surface. */
const EditorShellContent = ({ children }: PropsWithChildren) => {
	const project = useEditorProject();
	const registry = useContext(RegistryContext);
	const staged = useAtomValue(EditorProjectDraftAtom(project.projectId));
	const stagedCount = Object.keys(staged).length;
	const pendingMutations = useAtomValue(EditorProjectMutationPendingAtom(project.projectId));
	const formDirtyAtom = EditorProjectFormDirtyAtom(project.projectId);
	useAtomValue(formDirtyAtom);
	const router = useRouter();
	const [optimisticTab, setOptimisticTab] = useState<EditorTab>();
	const [exitError, setExitError] = useState<unknown>();
	const [exitPending, setExitPending] = useState(false);
	const persist = useMutation({
		mutationKey: [
			"editor",
			project.projectId,
			"persist",
		],
		mutationFn: () =>
			RendererRuntime.runPromise(persistEditorProjectMutationFx(project.projectId)),
	});
	const projectRoot = `/editor/${project.projectId}`;
	useEffect(
		() =>
			window.arkini.lifecycle.onCloseFailed((error) => {
				setExitError(error);
				setExitPending(false);
			}),
		[],
	);
	useBlocker({
		enableBeforeUnload: false,
		shouldBlockFn: async ({ next }) => {
			if (next.pathname === projectRoot || next.pathname.startsWith(`${projectRoot}/`)) {
				if (registry.get(formDirtyAtom)) {
					setExitError(new Error("Save the current form before leaving it."));
					return true;
				}
				return false;
			}
			setExitError(undefined);
			setExitPending(true);
			try {
				await RendererRuntime.runPromise(closeEditorProjectSessionFx(project.projectId));
				releaseEditorProjectSession(project.projectId);
				return false;
			} catch (error) {
				resumeEditorProjectSession(project.projectId);
				setExitError(error);
				setExitPending(false);
				return true;
			}
		},
	});
	const params = {
		projectId: project.projectId,
	};
	useEffect(
		() =>
			router.subscribe("onResolved", ({ toLocation }) => {
				setOptimisticTab((current) =>
					current !== undefined && readEditorTab(toLocation.pathname) === current
						? undefined
						: current,
				);
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
			if (registry.get(formDirtyAtom)) {
				event.preventDefault();
				setExitError(new Error("Save the current form before leaving it."));
				return;
			}
			setExitError(undefined);
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
						to="/editor/$projectId/assets"
						params={params}
						className={readTabClassName("assets")}
						activeProps={readActiveTabProps()}
						onClick={createTabClickHandler("assets")}
					>
						Assets
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
				<Button
					className="min-h-0 shrink-0 px-4 py-2 text-sm"
					disabled={stagedCount === 0 || persist.isPending || exitPending}
					cursorIntent={persist.isPending ? "progress" : undefined}
					onClick={() => {
						setExitError(undefined);
						persist.mutate(undefined, {
							onError: setExitError,
						});
					}}
				>
					{persist.isPending
						? "Saving…"
						: stagedCount > 0
							? `Save (${stagedCount})`
							: "Save"}
				</Button>
				<PrimaryButton
					className="min-h-0 shrink-0 px-4 py-2 text-sm"
					disabled={exitPending}
					cursorIntent={exitPending || pendingMutations > 0 ? "progress" : undefined}
					onClick={() => {
						if (exitPending) return;
						setExitError(undefined);
						if (stagedCount > 0) {
							setExitPending(true);
							void persist
								.mutateAsync()
								.then(() =>
									router.navigate({
										to: "/main-menu",
									}),
								)
								.catch((error: unknown) => {
									setExitError(error);
									setExitPending(false);
								});
							return;
						}
						void router.navigate({
							to: "/main-menu",
						});
					}}
				>
					{exitPending || pendingMutations > 0 ? "Saving…" : "Save & exit"}
				</PrimaryButton>
				{exitError === undefined && persist.error === null ? null : (
					<p
						className="basis-full text-right text-xs text-danger"
						role="alert"
					>
						{(() => {
							const error = exitError ?? persist.error;
							return error instanceof Error
								? error.message
								: "Editor could not finish saving. Try again.";
						})()}
					</p>
				)}
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

export const EditorShell = EditorShellContent;
