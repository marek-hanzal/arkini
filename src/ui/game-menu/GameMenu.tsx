import { useNavigate } from "@tanstack/react-router";
import { motion } from "motion/react";
import type { Game } from "~/bridge/game/Game";
import { type KeyboardEvent as ReactKeyboardEvent, useEffect, useRef, useState } from "react";

import { Button, DangerButton, PrimaryButton } from "~/ui/button/Button";
import type { GameMenuPhase } from "~/ui/game-menu/GameMenuControl";
import { useGameMenuControl } from "~/ui/game-menu/useGameMenuControl";
import { useSaveAndExitGameMutation } from "~/ui/game-menu/mutation/useSaveAndExitGameMutation";
import { useSaveGameMutation } from "~/ui/game-menu/mutation/useSaveGameMutation";
import { gameMenuBackdropViewTransitionName } from "~/ui/navigation/gameMenuBackdropViewTransitionName";
import { gameMenuDialogViewTransitionName } from "~/ui/navigation/gameMenuDialogViewTransitionName";

const focusableSelector = [
	"button:not([disabled])",
	"[href]",
	"input:not([disabled])",
	"select:not([disabled])",
	"textarea:not([disabled])",
	'[tabindex]:not([tabindex="-1"])',
].join(",");

const transition = {
	duration: 0.5,
	ease: [
		0.22,
		1,
		0.36,
		1,
	] as const,
};

const errorMessage = (error: unknown) => (error instanceof Error ? error.message : String(error));

const GameMenuDialog = ({
	game,
	phase,
}: {
	readonly game: Game;
	readonly phase: Exclude<GameMenuPhase, "closed">;
}) => {
	const menu = useGameMenuControl();
	const navigate = useNavigate();
	const save = useSaveGameMutation(game);
	const saveAndExit = useSaveAndExitGameMutation(game);
	const [confirmingDestroy, setConfirmingDestroy] = useState(false);
	const [navigationError, setNavigationError] = useState<unknown>();
	const dialogRef = useRef<HTMLDivElement>(null);
	const previousFocusRef = useRef<HTMLElement | null>(null);
	const completedPhaseRef = useRef<GameMenuPhase | null>(null);
	const activeRequestRef = useRef<
		"save" | "save-and-exit" | "hard-reset" | "main-menu" | "settings" | null
	>(null);
	const mutationPending = save.isPending || saveAndExit.isPending;
	const pending = mutationPending || menu.routePending;
	const exiting = phase === "exiting";
	const actionDisabled = phase !== "open" || pending;
	const gameActionDisabled = actionDisabled;

	useEffect(() => {
		previousFocusRef.current =
			document.activeElement instanceof HTMLElement ? document.activeElement : null;
		dialogRef.current?.focus();
		return () => {
			const previousFocus = previousFocusRef.current;
			if (previousFocus?.isConnected === true) {
				previousFocus.focus();
				return;
			}
			document.querySelector<HTMLElement>('[data-ui="GameShell"]')?.focus();
		};
	}, []);

	useEffect(() => {
		if (phase !== "open") return;
		const firstControl = dialogRef.current?.querySelector<HTMLElement>(focusableSelector);
		firstControl?.focus();
	}, [
		phase,
	]);

	useEffect(() => {
		completedPhaseRef.current = null;
	}, [
		phase,
	]);

	const completeMotionPhase = () => {
		if (phase === "open" || completedPhaseRef.current === phase) return;
		completedPhaseRef.current = phase;
		if (phase === "entering") menu.completeEnter();
		else menu.completeExit();
	};

	const keepFocusInside = (event: ReactKeyboardEvent<HTMLDivElement>) => {
		if (event.key === "Escape" && (pending || exiting)) {
			event.preventDefault();
			event.stopPropagation();
			return;
		}
		if (event.key !== "Tab") return;
		const controls = Array.from(
			dialogRef.current?.querySelectorAll<HTMLElement>(focusableSelector) ?? [],
		);
		if (controls.length === 0) {
			event.preventDefault();
			dialogRef.current?.focus();
			return;
		}
		const first = controls[0];
		const last = controls.at(-1);
		if (first === undefined || last === undefined) return;
		if (event.shiftKey && document.activeElement === first) {
			event.preventDefault();
			last.focus();
			return;
		}
		if (!event.shiftKey && document.activeElement === last) {
			event.preventDefault();
			first.focus();
		}
	};

	const requestRoute = (destination: "settings" | "main-menu") => {
		if (activeRequestRef.current !== null || !menu.beginRouteRequest()) return;
		activeRequestRef.current = destination;
		setNavigationError(undefined);
		const request = navigate({
			to: "/game/$packageId/action/leave",
			params: {
				packageId: game.arkpack.packageId,
			},
			search: {
				destination,
			},
		});
		void request.catch(setNavigationError).finally(() => {
			activeRequestRef.current = null;
			menu.completeRouteRequest();
		});
	};

	const requestSettings = () => requestRoute("settings");
	const requestMainMenu = () => requestRoute("main-menu");

	const requestSave = () => {
		if (phase !== "open" || menu.routePending || activeRequestRef.current !== null) return;
		activeRequestRef.current = "save";
		save.mutate(undefined, {
			onSettled: () => {
				activeRequestRef.current = null;
			},
		});
	};

	const requestSaveAndExit = () => {
		if (phase !== "open" || menu.routePending || activeRequestRef.current !== null) return;
		activeRequestRef.current = "save-and-exit";
		saveAndExit.mutate(undefined, {
			onSettled: () => {
				activeRequestRef.current = null;
			},
		});
	};

	const requestHardReset = () => {
		if (activeRequestRef.current !== null || !menu.beginRouteRequest()) return;
		activeRequestRef.current = "hard-reset";
		setNavigationError(undefined);
		void navigate({
			to: "/game/$packageId/action/reset",
			params: {
				packageId: game.arkpack.packageId,
			},
		})
			.catch(setNavigationError)
			.finally(() => {
				activeRequestRef.current = null;
				menu.completeRouteRequest();
			});
	};

	const status = saveAndExit.isPending
		? "Saving and exiting Arkini…"
		: save.isPending
			? "Saving…"
			: saveAndExit.isError
				? `Save and exit failed: ${errorMessage(saveAndExit.error)}`
				: save.isError
					? `Save failed: ${errorMessage(save.error)}`
					: navigationError !== undefined
						? `Navigation failed: ${errorMessage(navigationError)}`
						: menu.routePending
							? "Opening action page…"
							: save.isSuccess
								? "Saved."
								: null;

	return (
		<motion.div
			className="absolute inset-0 z-50 grid place-items-center overflow-hidden bg-overlay/95 p-[var(--ak-viewport-padding)] text-overlay-foreground"
			data-ui="GameMenuBackdrop"
			data-phase={phase}
			style={{
				viewTransitionName: gameMenuBackdropViewTransitionName,
			}}
			initial={{
				opacity: 0,
			}}
			animate={{
				opacity: phase === "exiting" ? 0 : 1,
			}}
			transition={transition}
		>
			<motion.div
				ref={dialogRef}
				role="dialog"
				aria-modal="true"
				aria-labelledby="game-menu-title"
				className="max-h-full w-full max-w-sm overflow-y-auto rounded-2xl border border-line-strong bg-surface-raised p-[var(--ak-panel-padding)] text-foreground shadow-2xl outline-none"
				data-ui="GameMenu"
				tabIndex={-1}
				style={{
					viewTransitionName: gameMenuDialogViewTransitionName,
				}}
				initial={{
					opacity: 0,
					scale: 0.975,
					y: 8,
					filter: "blur(6px)",
				}}
				animate={
					phase === "exiting"
						? {
								opacity: 0,
								scale: 0.985,
								y: 6,
								filter: "blur(5px)",
							}
						: {
								opacity: 1,
								scale: 1,
								y: 0,
								filter: "blur(0px)",
							}
				}
				transition={transition}
				onAnimationComplete={completeMotionPhase}
				onKeyDown={keepFocusInside}
			>
				<h2
					id="game-menu-title"
					className="mb-4 text-center text-lg font-semibold"
				>
					Game menu
				</h2>

				<div className="grid gap-2">
					<PrimaryButton
						className="w-full"
						disabled={gameActionDisabled}
						onClick={() => void menu.close()}
					>
						Return to game
					</PrimaryButton>
					<Button
						className="w-full shadow-none backdrop-blur-none"
						disabled={actionDisabled}
						onClick={requestSettings}
					>
						Settings
					</Button>
					<Button
						className="w-full shadow-none backdrop-blur-none"
						disabled={actionDisabled}
						onClick={requestMainMenu}
					>
						Main Menu
					</Button>

					<div className="my-2 border-t border-line" />

					<Button
						className="w-full shadow-none backdrop-blur-none"
						disabled={gameActionDisabled}
						onClick={requestSave}
					>
						Save
					</Button>
					<Button
						className="w-full shadow-none backdrop-blur-none"
						disabled={gameActionDisabled}
						onClick={requestSaveAndExit}
					>
						Save and exit
					</Button>

					<div className="my-2 border-t border-line" />

					<section
						className="rounded-xl border border-danger/35 bg-danger/5 p-3"
						aria-labelledby="game-menu-developer-title"
					>
						<h3
							id="game-menu-developer-title"
							className="mb-2 text-xs font-bold uppercase tracking-widest text-danger"
						>
							Developer
						</h3>
						{confirmingDestroy ? (
							<div className="grid gap-2">
								<p className="text-sm text-muted">
									Current progress will be permanently deleted and the game will
									restart from a fresh save.
								</p>
								<div className="grid grid-cols-2 gap-2">
									<Button
										className="min-h-0 px-3 py-2 shadow-none backdrop-blur-none"
										disabled={actionDisabled}
										onClick={() => setConfirmingDestroy(false)}
									>
										Cancel
									</Button>
									<DangerButton
										className="min-h-0 px-3 py-2 shadow-none"
										disabled={gameActionDisabled}
										onClick={requestHardReset}
									>
										Destroy permanently
									</DangerButton>
								</div>
							</div>
						) : (
							<DangerButton
								className="w-full shadow-none"
								disabled={gameActionDisabled}
								onClick={() => setConfirmingDestroy(true)}
							>
								Destroy
							</DangerButton>
						)}
					</section>
				</div>

				<div
					className="mt-4 min-h-5 text-center text-sm text-muted"
					aria-live="polite"
					data-ui="GameMenuStatus"
				>
					{status}
				</div>
			</motion.div>
		</motion.div>
	);
};

/** Renders the active game overlay through one explicit enter/open/exit lifecycle. */
export const GameMenu = ({ game }: { readonly game: Game }) => {
	const { phase } = useGameMenuControl();
	return phase === "closed" ? null : (
		<GameMenuDialog
			game={game}
			phase={phase}
		/>
	);
};
