import { useAtomSet, useAtomValue } from "@effect/atom-react";
import { useRouter } from "@tanstack/react-router";
import {
	useCallback,
	useEffect,
	useState,
	type MouseEventHandler,
	type PropsWithChildren,
} from "react";

import { openEditorProjectSessionAtom } from "~/bridge/editor/openEditorProjectSessionAtom";
import { releaseEditorProjectSessionAtom } from "~/bridge/editor/releaseEditorProjectSessionAtom";
import { closeEditorProjectSessionAtom } from "~/bridge/editor/closeEditorProjectSessionAtom";
import { EditorProjectDraftAtom } from "~/bridge/editor/EditorProjectDraftAtom";
import { persistEditorProjectCommandAtom } from "~/bridge/editor/persistEditorProjectCommandAtom";
import { useEditorProject } from "~/bridge/editor/useEditorProject";
import { Button, ButtonLink, PrimaryButton } from "~/ui/button/Button";
import { EditorFormActionsProvider, useEditorFormActions } from "~/ui/editor/EditorFormActions";
import { readSettledAsyncResultError } from "~/ui/reactivity/readSettledAsyncResultError";

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

const readErrorMessage = (error: unknown) => {
	if (typeof error === "string") return error;
	if (
		typeof error === "object" &&
		error !== null &&
		"message" in error &&
		typeof error.message === "string"
	) {
		return error.message;
	}
	return "Editor could not finish the requested action.";
};

/** Keeps editor-wide navigation stable while child tools replace only the content surface. */
const EditorShellContent = ({ children }: PropsWithChildren) => {
	const project = useEditorProject();
	const form = useEditorFormActions();
	const router = useRouter();
	const closeProjectSession = useAtomSet(closeEditorProjectSessionAtom, {
		mode: "promise",
	});
	const openProjectSession = useAtomSet(openEditorProjectSessionAtom, {
		mode: "promise",
	});
	const releaseProjectSession = useAtomSet(releaseEditorProjectSessionAtom, {
		mode: "promise",
	});
	const staged = useAtomValue(EditorProjectDraftAtom(project.projectId));
	const updateStaged = useAtomSet(EditorProjectDraftAtom(project.projectId));
	const persistResult = useAtomValue(persistEditorProjectCommandAtom(project.projectId));
	const persistProject = useAtomSet(persistEditorProjectCommandAtom(project.projectId), {
		mode: "promise",
	});
	const [optimisticTab, setOptimisticTab] = useState<EditorTab>();
	const [exitRequested, setExitRequested] = useState(false);
	const [exitError, setExitError] = useState<unknown>();
	const [exitPending, setExitPending] = useState(false);
	const params = {
		projectId: project.projectId,
	};

	useEffect(
		() =>
			window.arkini.lifecycle.onCloseFailed((error) => {
				setExitError(error);
				setExitPending(false);
			}),
		[],
	);
	useEffect(() => {
		if (form?.isDirty === true) return;
		setExitRequested(false);
	}, [
		form?.isDirty,
	]);
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

	const closeAndExit = useCallback(async () => {
		if (exitPending) return;
		setExitError(undefined);
		setExitPending(true);
		try {
			await closeProjectSession(project.projectId);
			await releaseProjectSession(project.projectId);
			await router.navigate({
				to: "/main-menu",
			});
		} catch (error) {
			await openProjectSession(project.projectId);
			setExitError(error);
			setExitPending(false);
		}
	}, [
		closeProjectSession,
		exitPending,
		openProjectSession,
		project.projectId,
		releaseProjectSession,
		router,
	]);
	const saveForm = useCallback(async () => {
		if (form === undefined || !form.isDirty || form.isSaving) return;
		setExitError(undefined);
		try {
			await form.save();
		} catch {
			// The form or project command owns and publishes its exact mutation error.
		}
	}, [
		form,
	]);
	const persist = useCallback(async () => {
		if (persistResult.waiting || Object.keys(staged).length === 0) return false;
		setExitError(undefined);
		try {
			await persistProject();
			return true;
		} catch {
			// The command result owns and publishes its exact mutation error.
			return false;
		}
	}, [
		persistProject,
		persistResult.waiting,
		staged,
	]);
	const discard = useCallback(() => {
		form?.discard();
		setExitError(undefined);
	}, [
		form,
	]);
	const saveAndExit = useCallback(async () => {
		if (form?.isSaving === true || persistResult.waiting) return;
		setExitError(undefined);
		try {
			if (form?.isDirty === true && !(await form.save())) return;
			await persistProject();
			await closeAndExit();
		} catch {
			// The form owns and publishes its exact mutation error.
		}
	}, [
		closeAndExit,
		form,
		persistProject,
		persistResult.waiting,
	]);
	const discardAndExit = useCallback(async () => {
		form?.discard();
		updateStaged({
			action: "clear",
		});
		await closeAndExit();
	}, [
		closeAndExit,
		form,
		updateStaged,
	]);
	const requestExit = useCallback(() => {
		setExitError(undefined);
		if (form?.isDirty === true || Object.keys(staged).length > 0) {
			setExitRequested(true);
			return;
		}
		void closeAndExit();
	}, [
		closeAndExit,
		form?.isDirty,
		staged,
	]);

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
			setExitError(undefined);
			setExitRequested(false);
			setOptimisticTab(tab);
		};
	const persistError = readSettledAsyncResultError(persistResult);
	const statusError = form?.error ?? persistError ?? exitError;
	const hasStatusSlot =
		form !== undefined || Object.keys(staged).length > 0 || statusError !== undefined;
	const statusVisible = form?.isDirty === true || exitRequested || statusError !== undefined;
	const statusCopy =
		statusError !== undefined
			? readErrorMessage(statusError)
			: exitRequested
				? "The editor has unsaved changes. Save or discard them before exiting."
				: "This form has unsaved changes.";
	const stagedCount = Object.keys(staged).length;

	return (
		<div
			className={`grid h-dvh min-h-0 overflow-hidden bg-[var(--ak-game-shell-background)] text-foreground ${
				hasStatusSlot
					? "grid-rows-[auto_2.5rem_minmax(0,1fr)]"
					: "grid-rows-[auto_minmax(0,1fr)]"
			}`}
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
						to="/editor/$projectId/editor/items/list"
						params={params}
						className={readTabClassName("editor")}
						activeProps={readActiveTabProps()}
						onClick={createTabClickHandler("editor")}
					>
						Items
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
					disabled={
						stagedCount === 0 ||
						form?.isDirty === true ||
						persistResult.waiting ||
						exitPending
					}
					cursorIntent={persistResult.waiting ? "progress" : undefined}
					onClick={() => void persist()}
				>
					{persistResult.waiting
						? "Saving…"
						: stagedCount > 0
							? `Save (${stagedCount})`
							: "Save"}
				</Button>
				<PrimaryButton
					className="min-h-0 shrink-0 px-4 py-2 text-sm"
					disabled={exitPending || form?.isSaving === true || persistResult.waiting}
					cursorIntent={
						exitPending || form?.isSaving === true || persistResult.waiting
							? "progress"
							: undefined
					}
					onClick={requestExit}
				>
					{exitPending ? "Exiting…" : "Exit"}
				</PrimaryButton>
			</header>
			{hasStatusSlot ? (
				<div
					className="relative z-10 h-10 border-b border-transparent px-[var(--ak-viewport-padding)]"
					data-ui="EditorFormStatusSlot"
				>
					<div
						className={`flex h-full min-w-0 items-center gap-3 rounded-b-xl border-x border-b px-4 text-sm transition-[opacity,transform,background-color,border-color] duration-200 ${
							statusVisible
								? "translate-y-0 border-accent/45 bg-accent/10 opacity-100"
								: "pointer-events-none -translate-y-1 border-transparent opacity-0"
						}`}
						aria-hidden={!statusVisible}
						role={statusError === undefined ? "status" : "alert"}
					>
						<p
							className={`min-w-0 flex-1 truncate ${
								statusError === undefined ? "text-foreground" : "text-danger"
							}`}
						>
							{statusCopy}
						</p>
						{form?.isDirty === true || (exitRequested && stagedCount > 0) ? (
							<>
								<button
									type="button"
									className="cursor-pointer text-sm font-semibold text-muted underline decoration-transparent underline-offset-4 transition-colors hover:text-foreground hover:decoration-current disabled:cursor-not-allowed disabled:opacity-60"
									disabled={
										form?.isSaving === true ||
										persistResult.waiting ||
										exitPending
									}
									onClick={() => {
										if (exitRequested) void discardAndExit();
										else discard();
									}}
								>
									Discard
								</button>
								<button
									type="button"
									className="cursor-pointer text-sm font-semibold text-accent underline decoration-transparent underline-offset-4 transition-colors hover:text-accent-hover hover:decoration-current disabled:cursor-not-allowed disabled:opacity-60"
									disabled={
										form?.isSaving === true ||
										persistResult.waiting ||
										exitPending
									}
									onClick={() =>
										void (exitRequested ? saveAndExit() : saveForm())
									}
								>
									{form?.isSaving === true || persistResult.waiting
										? "Saving…"
										: "Save"}
								</button>
							</>
						) : null}
					</div>
				</div>
			) : null}
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

export const EditorShell = ({ children }: PropsWithChildren) => (
	<EditorFormActionsProvider>
		<EditorShellContent>{children}</EditorShellContent>
	</EditorFormActionsProvider>
);
