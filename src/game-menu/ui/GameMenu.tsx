import { motion } from "motion/react";
import { useEffect, useRef } from "react";
import { match } from "ts-pattern";

import type { Game } from "~/renderer/game/Game";
import { useCheatAvailability } from "~/application-settings/ui/useCheatAvailability";
import { Button, DangerButton, PrimaryButton } from "~/ui/button/Button";
import type { GameMenuPhase } from "~/game-menu/type/GameMenuControl";
import { useGameMenuActions } from "~/game-menu/ui/useGameMenuActions";
import { useGameMenuControl } from "~/game-menu/ui/GameMenuProvider";
import { overlayFocusableSelector } from "~/ui/focus/overlayFocusableSelector";

const gameMenuBackdropViewTransitionName = "arkini-game-menu-backdrop";
const gameMenuDialogViewTransitionName = "arkini-game-menu-dialog";

const transition = {
	duration: 0.5,
	ease: [
		0.22,
		1,
		0.36,
		1,
	] as const,
};

const visibleDialog = {
	opacity: 1,
	scale: 1,
	y: 0,
	filter: "blur(0px)",
};

const exitingDialog = {
	opacity: 0,
	scale: 0.985,
	y: 6,
	filter: "blur(5px)",
};

const useGameMenuFocus = ({ phase }: { readonly phase: Exclude<GameMenuPhase, "closed"> }) => {
	const overlayRef = useRef<HTMLDivElement>(null);
	const previousFocusRef = useRef<HTMLElement | null>(null);

	useEffect(() => {
		previousFocusRef.current =
			document.activeElement instanceof HTMLElement ? document.activeElement : null;
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
		overlayRef.current?.querySelector<HTMLElement>(overlayFocusableSelector)?.focus();
	}, [
		phase,
	]);

	return {
		overlayRef,
	};
};

const useGameMenuMotion = (phase: Exclude<GameMenuPhase, "closed">) => {
	const menu = useGameMenuControl();
	const completedPhaseRef = useRef<GameMenuPhase | null>(null);

	useEffect(() => {
		completedPhaseRef.current = null;
	}, [
		phase,
	]);

	const completeMotionPhase = () => {
		if (completedPhaseRef.current === phase) return;
		match(phase)
			.with("entering", () => {
				completedPhaseRef.current = phase;
				menu.completeEnter();
			})
			.with("open", () => undefined)
			.with("exiting", () => {
				completedPhaseRef.current = phase;
				menu.completeExit();
			})
			.exhaustive();
	};

	const visual = match(phase)
		.with("entering", "open", () => ({
			backdropOpacity: 1,
			dialog: visibleDialog,
		}))
		.with("exiting", () => ({
			backdropOpacity: 0,
			dialog: exitingDialog,
		}))
		.exhaustive();

	return {
		...visual,
		completeMotionPhase,
	};
};

const GameMenuDialog = ({
	game,
	phase,
}: {
	readonly game: Game;
	readonly phase: Exclude<GameMenuPhase, "closed">;
}) => {
	const cheatAvailability = useCheatAvailability();
	const actions = useGameMenuActions({
		game,
		phase,
	});
	const actorMotion = useGameMenuMotion(phase);
	const actionCursorIntent = actions.pending ? "progress" : undefined;
	const focus = useGameMenuFocus({
		phase,
	});

	return (
		<motion.div
			className="absolute inset-0 z-[80] grid cursor-default place-items-center overflow-hidden bg-overlay/95 p-[var(--ak-viewport-padding)] text-overlay-foreground"
			data-ui="GameMenuBackdrop"
			data-phase={phase}
			style={{
				viewTransitionName: gameMenuBackdropViewTransitionName,
			}}
			initial={{
				opacity: 0,
			}}
			animate={{
				opacity: actorMotion.backdropOpacity,
			}}
			transition={transition}
		>
			<motion.div
				ref={focus.overlayRef}
				className="max-h-full w-full max-w-sm cursor-default overflow-y-auto rounded-2xl border border-line-strong bg-surface-raised p-[var(--ak-panel-padding)] text-foreground shadow-2xl outline-none"
				data-ui="GameMenu"
				style={{
					viewTransitionName: gameMenuDialogViewTransitionName,
				}}
				initial={{
					opacity: 0,
					scale: 0.975,
					y: 8,
					filter: "blur(6px)",
				}}
				animate={actorMotion.dialog}
				transition={transition}
				onAnimationComplete={actorMotion.completeMotionPhase}
			>
				<h2 className="mb-4 text-center text-lg font-semibold">Game menu</h2>

				<div className="grid gap-2">
					<PrimaryButton
						className="w-full"
						cursorIntent={actionCursorIntent}
						disabled={actions.actionDisabled}
						onClick={() => void actions.close()}
					>
						Return to game
					</PrimaryButton>
					<Button
						className="w-full shadow-none"
						cursorIntent={actionCursorIntent}
						disabled={actions.actionDisabled}
						onClick={actions.requestSettings}
					>
						Settings
					</Button>
					{cheatAvailability.available ? (
						<Button
							className="w-full shadow-none"
							cursorIntent={actionCursorIntent}
							disabled={actions.actionDisabled}
							onClick={actions.requestCheats}
						>
							Cheats
						</Button>
					) : null}
					<Button
						className="w-full shadow-none"
						cursorIntent={actionCursorIntent}
						disabled={actions.actionDisabled}
						onClick={actions.requestMainMenu}
					>
						Main Menu
					</Button>

					<div className="my-2 border-t border-line" />

					<Button
						className="w-full shadow-none"
						cursorIntent={actionCursorIntent}
						disabled={actions.actionDisabled}
						onClick={actions.requestSave}
					>
						Save
					</Button>
					<Button
						className="w-full shadow-none"
						cursorIntent={actionCursorIntent}
						disabled={actions.actionDisabled}
						onClick={actions.requestSaveAndExit}
					>
						Save and exit
					</Button>

					<div className="my-2 border-t border-line" />

					<section className="rounded-xl border border-danger/35 bg-danger/5 p-3">
						<h3 className="mb-2 text-xs font-bold uppercase tracking-widest text-danger">
							Developer
						</h3>
						{actions.confirmingDestroy ? (
							<div className="grid gap-2">
								<p className="text-sm text-muted">
									Current progress will be permanently deleted and the game will
									restart from a fresh save.
								</p>
								<div className="grid grid-cols-2 gap-2">
									<Button
										className="min-h-0 px-3 py-2 shadow-none"
										cursorIntent={actionCursorIntent}
										disabled={actions.actionDisabled}
										onClick={() => actions.setConfirmingDestroy(false)}
									>
										Cancel
									</Button>
									<DangerButton
										className="min-h-0 px-3 py-2 shadow-none"
										cursorIntent={actionCursorIntent}
										disabled={actions.actionDisabled}
										onClick={actions.requestHardReset}
									>
										Destroy permanently
									</DangerButton>
								</div>
							</div>
						) : (
							<DangerButton
								className="w-full shadow-none"
								cursorIntent={actionCursorIntent}
								disabled={actions.actionDisabled}
								onClick={() => actions.setConfirmingDestroy(true)}
							>
								Destroy
							</DangerButton>
						)}
					</section>
				</div>

				<div
					className="mt-4 min-h-5 text-center text-sm text-muted"
					data-ui="GameMenuStatus"
				>
					{actions.status}
				</div>
			</motion.div>
		</motion.div>
	);
};

/** Renders the active game overlay through one explicit enter/open/exit lifecycle. */
export const GameMenu = ({ game }: { readonly game: Game }) => {
	const { phase } = useGameMenuControl();
	return match(phase)
		.with("closed", () => null)
		.with("entering", "open", "exiting", (activePhase) => (
			<GameMenuDialog
				game={game}
				phase={activePhase}
			/>
		))
		.exhaustive();
};
