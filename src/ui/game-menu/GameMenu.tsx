import { motion } from "motion/react";
import { match } from "ts-pattern";

import type { Game } from "~/bridge/game/Game";
import { Button, DangerButton, PrimaryButton } from "~/ui/button/Button";
import type { GameMenuPhase } from "~/ui/game-menu/GameMenuControl";
import { useGameMenuActions } from "~/ui/game-menu/useGameMenuActions";
import { useGameMenuControl } from "~/ui/game-menu/useGameMenuControl";
import { useGameMenuFocus } from "~/ui/game-menu/useGameMenuFocus";
import { useGameMenuMotion } from "~/ui/game-menu/useGameMenuMotion";
import { gameMenuBackdropViewTransitionName } from "~/ui/navigation/gameMenuBackdropViewTransitionName";
import { gameMenuDialogViewTransitionName } from "~/ui/navigation/gameMenuDialogViewTransitionName";

const transition = {
	duration: 0.5,
	ease: [
		0.22,
		1,
		0.36,
		1,
	] as const,
};

const GameMenuDialog = ({
	game,
	phase,
}: {
	readonly game: Game;
	readonly phase: Exclude<GameMenuPhase, "closed">;
}) => {
	const actions = useGameMenuActions({
		game,
		phase,
	});
	const actorMotion = useGameMenuMotion(phase);
	const focus = useGameMenuFocus({
		phase,
		blocked: actions.pending || phase === "exiting",
	});

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
				opacity: actorMotion.backdropOpacity,
			}}
			transition={transition}
		>
			<motion.div
				ref={focus.dialogRef}
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
				animate={actorMotion.dialog}
				transition={transition}
				onAnimationComplete={actorMotion.completeMotionPhase}
				onKeyDown={focus.keepFocusInside}
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
						disabled={actions.actionDisabled}
						onClick={() => void actions.close()}
					>
						Return to game
					</PrimaryButton>
					<Button
						className="w-full shadow-none backdrop-blur-none"
						disabled={actions.actionDisabled}
						onClick={actions.requestSettings}
					>
						Settings
					</Button>
					<Button
						className="w-full shadow-none backdrop-blur-none"
						disabled={actions.actionDisabled}
						onClick={actions.requestMainMenu}
					>
						Main Menu
					</Button>

					<div className="my-2 border-t border-line" />

					<Button
						className="w-full shadow-none backdrop-blur-none"
						disabled={actions.actionDisabled}
						onClick={actions.requestSave}
					>
						Save
					</Button>
					<Button
						className="w-full shadow-none backdrop-blur-none"
						disabled={actions.actionDisabled}
						onClick={actions.requestSaveAndExit}
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
						{actions.confirmingDestroy ? (
							<div className="grid gap-2">
								<p className="text-sm text-muted">
									Current progress will be permanently deleted and the game will
									restart from a fresh save.
								</p>
								<div className="grid grid-cols-2 gap-2">
									<Button
										className="min-h-0 px-3 py-2 shadow-none backdrop-blur-none"
										disabled={actions.actionDisabled}
										onClick={() => actions.setConfirmingDestroy(false)}
									>
										Cancel
									</Button>
									<DangerButton
										className="min-h-0 px-3 py-2 shadow-none"
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
					aria-live="polite"
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
