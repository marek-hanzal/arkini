import { useAtom, useAtomValue } from "@effect/atom-react";
import { createFileRoute } from "@tanstack/react-router";
import { Cause } from "effect";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";

import { ArkiniAppVersion, ArkiniDefaultPackageId } from "../../../shared/ArkiniAppMetadata";
import { useArkpacks } from "~/ui/arkpack/useArkpacks";
import { EditorServiceStatusAtom } from "~/ui/editor/EditorServiceStatusAtom";
import { Button, ButtonLink, PrimaryButton, PrimaryButtonLink } from "~/ui/button/Button";
import { LauncherStartupAtom } from "~/ui/launcher/LauncherStartupAtom";
import { MainMenuExitCommandAtom } from "~/ui/launcher/MainMenuExitCommandAtom";
import { MainPageLayout } from "~/ui/main-page/MainPageLayout";

export const Route = createFileRoute("/_launcher/main-menu")({
	component: () => {
		const { state: catalogState } = useArkpacks();
		const startup = useAtomValue(LauncherStartupAtom);
		const [exitState, requestExit] = useAtom(MainMenuExitCommandAtom);
		const editorStatus = useAtomValue(EditorServiceStatusAtom);
		const exitPending = exitState.kind === "pending";
		const defaultPackageAvailable =
			AsyncResult.isSuccess(startup) &&
			!startup.waiting &&
			startup.value.defaultPackageId === ArkiniDefaultPackageId &&
			catalogState.type === "ready" &&
			catalogState.arkpacks.some((arkpack) => arkpack.packageId === ArkiniDefaultPackageId);
		const playUnavailable =
			catalogState.type === "failed" ||
			(AsyncResult.isFailure(startup) && !startup.waiting) ||
			(catalogState.type === "ready" && AsyncResult.isSuccess(startup) && !startup.waiting);

		return (
			<MainPageLayout page="main-menu">
				<nav
					className="grid w-full gap-4"
					aria-label="Main menu"
					data-ui="MainMenu"
				>
					{defaultPackageAvailable ? (
						<PrimaryButtonLink
							to="/action/load-game/$packageId"
							preload={false}
							params={{
								packageId: ArkiniDefaultPackageId,
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
						to="/arkpacks"
						className="rounded-xl"
					>
						Arkpacks
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
						onClick={() => requestExit(undefined)}
					>
						Exit
					</Button>
					<p
						className="pt-1 text-center text-xs text-subtle"
						data-ui="ArkiniAppVersion"
					>
						v{ArkiniAppVersion}
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
			</MainPageLayout>
		);
	},
});
