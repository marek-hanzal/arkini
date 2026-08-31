import { motion } from "motion/react";

import type { Game } from "~/installed-game/type/Game";
import { useCheatAvailability } from "~/application-settings/ui/useCheatAvailability";
import { Button, DangerButton, PrimaryButton } from "~/ui/button/Button";
import { useGameMenuActions } from "~/game-menu/ui/useGameMenuActions";
import { useGameMenuFocus } from "~/game-menu/ui/useGameMenuFocus";
import { gameMenuTransition, useGameMenuMotion } from "~/game-menu/ui/useGameMenuMotion";

const gameMenuBackdropViewTransitionName = "arkini-game-menu-backdrop";
const gameMenuDialogViewTransitionName = "arkini-game-menu-dialog";

interface GameMenuDialogProps extends useGameMenuMotion.Props {
	readonly game: Game;
}

/** Composes menu actions, focus, and motion into the active overlay presentation. */
export const GameMenuDialog = ({ game, phase }: GameMenuDialogProps) => {
	const cheatAvailability = useCheatAvailability();
	const actions = useGameMenuActions({
		game,
		phase,
	});
	const actorMotion = useGameMenuMotion({
		phase,
	});
	const focus = useGameMenuFocus({
		phase,
	});
	const actionCursorIntent = actions.pending ? "progress" : undefined;

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
			transition={gameMenuTransition}
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
				transition={gameMenuTransition}
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
