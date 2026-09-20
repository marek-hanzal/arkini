import { useAtom, useAtomValue } from "@effect/atom-react";
import { createFileRoute } from "@tanstack/react-router";
import { Cause } from "effect";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";

import { SerakkiAppVersion, SerakkiDefaultPackageId } from "~shared/SerakkiAppMetadata";
import { useSerapacks } from "~/serapack-selector/ui/useSerapacks";
import { EditorServiceStatusAtom } from "~/project-authoring/atom/EditorServiceStatusAtom";
import { Button, ButtonLink, PrimaryButton, PrimaryButtonLink } from "~/ui/ui/Button";
import { LauncherStartupAtom } from "~/launcher/atom/LauncherStartupAtom";
import { MainMenuExitCommandAtom } from "~/launcher/atom/MainMenuExitCommandAtom";
import { LauncherPageLayout } from "~/launcher/ui/LauncherPageLayout";

export const Route = createFileRoute("/_launcher/main-menu")({
	component: () => {
		const { state: catalogState } = useSerapacks();
		const startup = useAtomValue(LauncherStartupAtom);
		const [exitState, requestExitFn] = useAtom(MainMenuExitCommandAtom);
		const editorStatus = useAtomValue(EditorServiceStatusAtom);
		const exitPending = exitState.kind === "pending";
		const defaultPackageAvailable =
			AsyncResult.isSuccess(startup) &&
			!startup.waiting &&
			startup.value.defaultPackageId === SerakkiDefaultPackageId &&
			catalogState.type === "ready" &&
			catalogState.serapacks.some(
				(serapack) => serapack.packageId === SerakkiDefaultPackageId,
			);
		const playUnavailable =
			catalogState.type === "failed" ||
			(AsyncResult.isFailure(startup) && !startup.waiting) ||
			(catalogState.type === "ready" && AsyncResult.isSuccess(startup) && !startup.waiting);

		return (
			<LauncherPageLayout page="main-menu">
				<nav
					className="grid w-full gap-4"
					data-ui="MainMenu"
				>
					{defaultPackageAvailable ? (
						<PrimaryButtonLink
							to="/action/load-game/$packageId"
							preload={false}
							params={{
								packageId: SerakkiDefaultPackageId,
							}}
							className="rounded-xl"
						>
							Play
						</PrimaryButtonLink>
					) : (
						<PrimaryButton
							className="rounded-xl"
							cursorIntent={playUnavailable ? "not-allowed" : "progress"}
							disabled
						>
							{playUnavailable ? "Play unavailable" : "Preparing Play…"}
						</PrimaryButton>
					)}
					<ButtonLink
						to="/serapacks"
						className="rounded-xl"
					>
						Serapacks
					</ButtonLink>
					{editorStatus.type === "ready" ? (
						<ButtonLink
							to="/editor/welcome"
							preload={false}
							className="rounded-xl"
						>
							Editor
						</ButtonLink>
					) : (
						<Button
							className="rounded-xl"
							cursorIntent={
								editorStatus.type === "starting" ? "progress" : "not-allowed"
							}
							disabled
						>
							{editorStatus.type === "starting"
								? "Preparing Editor…"
								: "Editor unavailable"}
						</Button>
					)}
					<ButtonLink
						to="/settings"
						className="rounded-xl"
					>
						Settings
					</ButtonLink>
					<ButtonLink
						to="/about"
						className="rounded-xl"
					>
						About
					</ButtonLink>
					<Button
						className="rounded-xl"
						cursorIntent={exitPending ? "progress" : undefined}
						disabled={exitPending}
						onClick={() => requestExitFn(undefined)}
					>
						Exit
					</Button>
					<p
						className="pt-1 text-center text-xs text-subtle"
						data-ui="SerakkiAppVersion"
					>
						v{SerakkiAppVersion}
					</p>
					{catalogState.type === "failed" ? (
						<p className="text-center text-sm text-danger">
							Catalog failed: {String(catalogState.error)}
						</p>
					) : AsyncResult.isFailure(startup) && !startup.waiting ? (
						<p className="text-center text-sm text-danger">
							Startup failed: {String(Cause.squash(startup.cause))}
						</p>
					) : editorStatus.type === "unavailable" ? (
						<p className="text-center text-sm text-danger">{editorStatus.message}</p>
					) : exitState.kind === "error" ? (
						<p className="text-center text-sm text-danger">
							Exit failed: {String(exitState.error)}
						</p>
					) : exitState.kind === "requested" ? (
						<p className="text-center text-sm text-muted">Exit requested.</p>
					) : null}
				</nav>
			</LauncherPageLayout>
		);
	},
});
