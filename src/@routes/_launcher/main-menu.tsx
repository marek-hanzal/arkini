import { match } from "ts-pattern";
import { useAtom, useAtomValue } from "@effect/atom-react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AnimatePresence, motion } from "motion/react";
import { ArrowRight, LoaderCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { createElectronGameSaveStorageFx } from "~/game-persistence/fx/createElectronGameSaveStorageFx";
import { Cause, Effect } from "effect";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";

import { SerakkiAppVersion, SerakkiDefaultPackageId } from "~shared/SerakkiAppMetadata";
import { useSerapacks } from "~/serapack-selector/ui/useSerapacks";
import { Button, ButtonLink, PrimaryButton, PrimaryButtonLink } from "~/ui/ui/Button";
import { LauncherStartupAtom } from "~/launcher/atom/LauncherStartupAtom";
import { MainMenuExitCommandAtom } from "~/launcher/atom/MainMenuExitCommandAtom";
import { LauncherPageLayout } from "~/launcher/ui/LauncherPageLayout";
import { ExportDiagnosticsAtom } from "~/application-diagnostics/atom/ExportDiagnosticsAtom";

export const Route = createFileRoute("/_launcher/main-menu")({
	staleTime: 0,
	loader: ({ context, abortController }) =>
		context.rendererRuntime.runPromise(
			createElectronGameSaveStorageFx().pipe(
				Effect.flatMap((storage) =>
					storage.listFx({
						packageId: SerakkiDefaultPackageId,
					}),
				),
			),
			{
				signal: abortController.signal,
			},
		),
	component: () => {
		const navigateFn = useNavigate();
		const saves = Route.useLoaderData();
		const hasSave = saves.some((save) => save.savedAt !== null);
		const canContinue = saves.some((save) => save.slot === "current" && save.savedAt !== null);
		const [confirmingNewGame, setConfirmingNewGameFn] = useState(false);
		const { state: catalogState } = useSerapacks();
		const startup = useAtomValue(LauncherStartupAtom);
		const [exitState, requestExitFn] = useAtom(MainMenuExitCommandAtom);
		const [diagnosticsExportState, exportDiagnosticsFn] = useAtom(ExportDiagnosticsAtom);
		const exitPending = exitState.kind === "pending";
		const diagnosticsExportPending = diagnosticsExportState.kind === "pending";
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

		useEffect(() => {
			const onKeyDownFn = (event: KeyboardEvent) => {
				if (
					event.defaultPrevented ||
					event.repeat ||
					event.isComposing ||
					event.altKey ||
					event.ctrlKey ||
					event.metaKey ||
					(event.target instanceof HTMLElement &&
						(event.target.isContentEditable ||
							event.target.closest("input, textarea, select") !== null))
				)
					return;

				match(event.key)
					.with("c", () => {
						if (!defaultPackageAvailable || !canContinue) return;
						event.preventDefault();
						void navigateFn({
							to: "/action/load-game/$packageId",
							params: {
								packageId: SerakkiDefaultPackageId,
							},
						});
					})
					.with("g", () => {
						event.preventDefault();
						void navigateFn({
							to: "/serapacks",
						});
					})
					.with("s", () => {
						event.preventDefault();
						void navigateFn({
							to: "/settings",
						});
					})
					.with("a", () => {
						event.preventDefault();
						void navigateFn({
							to: "/about",
						});
					})
					.with("e", () => {
						if (exitPending) return;
						event.preventDefault();
						requestExitFn(undefined);
					})
					.otherwise(() => undefined);
			};
			window.addEventListener("keydown", onKeyDownFn);
			return () => window.removeEventListener("keydown", onKeyDownFn);
		}, [
			canContinue,
			defaultPackageAvailable,
			exitPending,
			navigateFn,
			requestExitFn,
		]);

		return (
			<LauncherPageLayout
				page="main-menu"
				foregroundOverlay={
					<div
						data-ui="MainMenuCommunityLinks"
						className="pointer-events-auto absolute bottom-6 right-6 flex items-center gap-3"
					>
						<a
							href="https://www.youtube.com/@Serakki-Game"
							target="_blank"
							rel="noreferrer"
							className="flex size-12 items-center justify-center text-accent transition-transform duration-200 ease-out hover:scale-110"
						>
							<svg
								viewBox="0 0 24 24"
								className="size-10"
								fill="currentColor"
							>
								<path
									fillRule="evenodd"
									d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.6 12 3.6 12 3.6s-7.5 0-9.4.5A3 3 0 0 0 .5 6.2C0 8.1 0 12 0 12s0 3.9.5 5.8a3 3 0 0 0 2.1 2.1c1.9.5 9.4.5 9.4.5s7.5 0 9.4-.5a3 3 0 0 0 2.1-2.1c.5-1.9.5-5.8.5-5.8s0-3.9-.5-5.8ZM9.6 15.6V8.4l6.3 3.6-6.3 3.6Z"
								/>
							</svg>
						</a>

						<a
							href="https://discord.gg/XtjRQgbdrK"
							target="_blank"
							rel="noreferrer"
							className="flex size-12 items-center justify-center text-accent transition-transform duration-200 ease-out hover:scale-110"
						>
							<svg
								viewBox="0 0 24 24"
								className="size-10"
								fill="currentColor"
							>
								<path d="M20.32 4.37a19.8 19.8 0 0 0-4.89-1.52l-.6 1.23a18.3 18.3 0 0 0-5.66 0l-.6-1.23a19.8 19.8 0 0 0-4.89 1.52C.59 8.96-.25 13.44.17 17.85a19.9 19.9 0 0 0 6 3.03l1.23-2a12.9 12.9 0 0 1-1.93-.93l.47-.37a14.2 14.2 0 0 0 12.12 0l.47.37c-.62.36-1.27.67-1.93.93l1.23 2a19.9 19.9 0 0 0 6-3.03c.49-5.11-.84-9.55-3.51-13.48ZM8.02 15.13c-1.18 0-2.15-1.08-2.15-2.41s.95-2.42 2.15-2.42c1.2 0 2.17 1.09 2.15 2.42 0 1.33-.95 2.41-2.15 2.41Zm7.96 0c-1.18 0-2.15-1.08-2.15-2.41s.95-2.42 2.15-2.42c1.2 0 2.17 1.09 2.15 2.42 0 1.33-.95 2.41-2.15 2.41Z" />
							</svg>
						</a>
					</div>
				}
			>
				<nav
					className="grid w-full gap-4 [&_button]:border-line/30 [&_a]:border-line/30"
					data-ui="MainMenu"
				>
					{defaultPackageAvailable ? (
						<>
							{canContinue && (
								<PrimaryButtonLink
									to="/action/load-game/$packageId"
									preload={false}
									params={{
										packageId: SerakkiDefaultPackageId,
									}}
									className="main-menu-continue rounded-xl"
								>
									Continue <ArrowRight className="ml-2.5 size-[1.5625rem]" />
								</PrimaryButtonLink>
							)}
							{hasSave ? (
								<section data-ui="MainMenuNewGameConfirmation">
									{confirmingNewGame ? (
										<ButtonLink
											className="main-menu-tinted-action w-full rounded-xl"
											to="/action/load-game/$packageId"
											params={{
												packageId: SerakkiDefaultPackageId,
											}}
											search={{
												newGame: true,
											}}
											preload={false}
										>
											New Game
										</ButtonLink>
									) : (
										<Button
											className="main-menu-tinted-action w-full rounded-xl"
											onClick={() => setConfirmingNewGameFn(true)}
										>
											New Game
										</Button>
									)}
									<AnimatePresence initial={false}>
										{confirmingNewGame && (
											<motion.div
												key="cancel"
												initial={{
													height: 0,
													opacity: 0,
												}}
												animate={{
													height: "auto",
													opacity: 1,
												}}
												exit={{
													height: 0,
													opacity: 0,
												}}
												transition={{
													duration: 0.18,
													ease: "easeOut",
												}}
												className="overflow-hidden"
											>
												<div className="pt-3">
													<Button
														className="main-menu-tinted-action w-full rounded-xl"
														onClick={() =>
															setConfirmingNewGameFn(false)
														}
													>
														Cancel
													</Button>
												</div>
											</motion.div>
										)}
									</AnimatePresence>
								</section>
							) : (
								<PrimaryButtonLink
									to="/action/load-game/$packageId"
									params={{
										packageId: SerakkiDefaultPackageId,
									}}
									preload={false}
									className="rounded-xl"
								>
									New Game
								</PrimaryButtonLink>
							)}
						</>
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
						className="main-menu-tinted-action rounded-xl"
					>
						Your games
					</ButtonLink>
					<ButtonLink
						to="/settings"
						className="main-menu-tinted-action rounded-xl"
					>
						Settings
					</ButtonLink>
					<ButtonLink
						to="/about"
						className="main-menu-tinted-action rounded-xl"
					>
						About
					</ButtonLink>
					<Button
						className="main-menu-tinted-action rounded-xl"
						cursorIntent={exitPending ? "progress" : undefined}
						disabled={exitPending}
						onClick={() => requestExitFn(undefined)}
					>
						Exit
					</Button>
					<div className="flex items-center justify-center gap-4 pt-1">
						<p
							className="text-xs text-subtle"
							data-ui="SerakkiAppVersion"
						>
							v{SerakkiAppVersion}
						</p>
						<button
							type="button"
							className="inline-flex cursor-pointer items-center gap-2 text-xs font-normal text-foreground underline-offset-4 transition-colors hover:text-accent hover:underline disabled:cursor-progress disabled:opacity-70"
							data-ui="ExportDiagnostics"
							disabled={diagnosticsExportPending}
							onClick={() => exportDiagnosticsFn(undefined)}
						>
							{diagnosticsExportPending ? (
								<LoaderCircle className="size-4 animate-spin" />
							) : null}
							Export diagnostics
						</button>
					</div>
					{match({
						catalogState,
						startup,
						exitState,
						diagnosticsExportState,
					})
						.with(
							{
								catalogState: {
									type: "failed",
								},
							},
							({ catalogState }) => (
								<p className="text-center text-sm text-danger">
									Catalog failed: {String(catalogState.error)}
								</p>
							),
						)
						.with(
							{
								startup: {
									_tag: "Failure",
									waiting: false,
								},
							},
							({ startup }) => (
								<p className="text-center text-sm text-danger">
									Startup failed: {String(Cause.squash(startup.cause))}
								</p>
							),
						)
						.with(
							{
								exitState: {
									kind: "error",
								},
							},
							({ exitState }) => (
								<p className="text-center text-sm text-danger">
									Exit failed: {String(exitState.error)}
								</p>
							),
						)
						.with(
							{
								diagnosticsExportState: {
									kind: "error",
								},
							},
							({ diagnosticsExportState }) => (
								<p className="text-center text-sm text-danger">
									Export failed: {String(diagnosticsExportState.error)}
								</p>
							),
						)
						.with(
							{
								exitState: {
									kind: "requested",
								},
							},
							() => <p className="text-center text-sm text-muted">Exit requested.</p>,
						)
						.otherwise(() => null)}
				</nav>
			</LauncherPageLayout>
		);
	},
});
