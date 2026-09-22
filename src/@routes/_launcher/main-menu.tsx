import { useAtom, useAtomValue } from "@effect/atom-react";
import { createFileRoute } from "@tanstack/react-router";
import { AnimatePresence, motion } from "motion/react";
import { ArrowRight, LoaderCircle } from "lucide-react";
import { useState } from "react";
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

		return (
			<LauncherPageLayout page="main-menu">
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
									className="rounded-xl"
								>
									Continue <ArrowRight className="ml-2 size-5" />
								</PrimaryButtonLink>
							)}
							{hasSave ? (
								<section data-ui="MainMenuNewGameConfirmation">
									{confirmingNewGame ? (
										<ButtonLink
											className="w-full rounded-xl"
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
											className="w-full rounded-xl"
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
														className="w-full rounded-xl"
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
						className="rounded-xl"
					>
						Your games
					</ButtonLink>
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
					<div className="flex items-center justify-center gap-4 pt-1">
						<p
							className="text-xs text-subtle"
							data-ui="SerakkiAppVersion"
						>
							v{SerakkiAppVersion}
						</p>
						<button
							type="button"
							className="inline-flex cursor-pointer items-center gap-2 text-xs font-normal text-white underline-offset-4 transition-colors hover:text-accent hover:underline disabled:cursor-progress disabled:opacity-70"
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
					{catalogState.type === "failed" ? (
						<p className="text-center text-sm text-danger">
							Catalog failed: {String(catalogState.error)}
						</p>
					) : AsyncResult.isFailure(startup) && !startup.waiting ? (
						<p className="text-center text-sm text-danger">
							Startup failed: {String(Cause.squash(startup.cause))}
						</p>
					) : exitState.kind === "error" ? (
						<p className="text-center text-sm text-danger">
							Exit failed: {String(exitState.error)}
						</p>
					) : diagnosticsExportState.kind === "error" ? (
						<p className="text-center text-sm text-danger">
							Export failed: {String(diagnosticsExportState.error)}
						</p>
					) : exitState.kind === "requested" ? (
						<p className="text-center text-sm text-muted">Exit requested.</p>
					) : null}
				</nav>
			</LauncherPageLayout>
		);
	},
});
