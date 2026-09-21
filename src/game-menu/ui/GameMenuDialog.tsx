import { GameSaveMenu } from "~/game-menu/ui/GameSaveMenu";
import { RotateCcw } from "lucide-react";
import { motion } from "motion/react";

import type { Game } from "~/installed-game/type/Game";
import { useCheatAvailability } from "~/application-settings/ui/useCheatAvailability";
import { Button, DangerButton, PrimaryButton } from "~/ui/ui/Button";
import type { useGameMenuActions } from "~/game-menu/ui/useGameMenuActions";
import { useGameMenuFocus } from "~/game-menu/ui/useGameMenuFocus";
import { gameMenuTransition, useGameMenuMotion } from "~/game-menu/ui/useGameMenuMotion";

const gameMenuBackdropViewTransitionName = "serakki-game-menu-backdrop";
const gameMenuDialogViewTransitionName = "serakki-game-menu-dialog";

interface GameMenuDialogProps extends useGameMenuMotion.Props {
	readonly game: Game;
	readonly actions: useGameMenuActions.Output;
}

/** Composes menu actions, focus, and motion into the active overlay presentation. */
export const GameMenuDialog = ({ game, phase, actions }: GameMenuDialogProps) => {
	const cheatAvailability = useCheatAvailability();
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
				className="max-h-full w-full max-w-sm cursor-default overflow-y-auto rounded-2xl border border-line-strong bg-modal p-[var(--ak-panel-padding)] text-foreground shadow-2xl outline-none"
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
				onAnimationComplete={actorMotion.completeMotionPhaseFn}
			>
				<h2 className="mb-4 text-center text-lg font-semibold">Game menu</h2>

				<div className="grid gap-2">
					<PrimaryButton
						className="w-full"
						cursorIntent={actionCursorIntent}
						disabled={actions.actionDisabled}
						onClick={() => void actions.closeFn()}
					>
						Return to game
					</PrimaryButton>
					<Button
						className="w-full shadow-none"
						cursorIntent={actionCursorIntent}
						disabled={actions.actionDisabled}
						onClick={actions.requestSettingsFn}
					>
						Settings
					</Button>
					{cheatAvailability.available ? (
						<Button
							className="w-full shadow-none"
							cursorIntent={actionCursorIntent}
							disabled={actions.actionDisabled}
							onClick={actions.requestCheatsFn}
						>
							Cheats
						</Button>
					) : null}
					<Button
						className="w-full shadow-none"
						cursorIntent={actionCursorIntent}
						disabled={actions.actionDisabled}
						onClick={actions.requestMainMenuFn}
					>
						Main Menu
					</Button>

					<div className="my-2 border-t border-line" />

					<Button
						className="w-full shadow-none"
						cursorIntent={actionCursorIntent}
						disabled={actions.actionDisabled}
						onClick={actions.requestSaveFn}
						title="Save · F5"
					>
						Save
					</Button>
					<GameSaveMenu
						game={game}
						disabled={actions.actionDisabled}
						onLoadFn={actions.requestLoadFn}
					/>
					<Button
						className="w-full shadow-none"
						cursorIntent={actionCursorIntent}
						disabled={actions.actionDisabled}
						onClick={actions.requestSaveAndExitFn}
					>
						Save and exit
					</Button>

					<div className="my-2 border-t border-line" />

					<section data-ui="GameMenuStartOver">
						{actions.confirmingReset ? (
							<div className="grid gap-2 rounded-xl border border-danger/35 bg-danger/5 p-3">
								<p className="text-sm text-muted">
									Start a new game from the beginning? All saves for this game
									will be permanently lost.
								</p>
								<div className="grid grid-cols-2 gap-2">
									<Button
										className="min-h-0 px-3 py-2 shadow-none"
										cursorIntent={actionCursorIntent}
										disabled={actions.actionDisabled}
										onClick={() => actions.setConfirmingResetFn(false)}
									>
										Cancel
									</Button>
									<DangerButton
										className="min-h-0 px-3 py-2 shadow-none"
										cursorIntent={actionCursorIntent}
										disabled={actions.actionDisabled}
										onClick={actions.requestHardResetFn}
									>
										Start over
									</DangerButton>
								</div>
							</div>
						) : (
							<Button
								className="w-full gap-2 border-danger/35 bg-danger/10 text-danger shadow-none hover:border-danger/60 hover:bg-danger/15"
								cursorIntent={actionCursorIntent}
								disabled={actions.actionDisabled}
								onClick={() => actions.setConfirmingResetFn(true)}
							>
								<RotateCcw className="size-5" />
								Start over
							</Button>
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
