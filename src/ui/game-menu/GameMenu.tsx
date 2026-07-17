import type { Game } from "~/bridge/game/Game";
import { type KeyboardEvent as ReactKeyboardEvent, useEffect, useRef, useState } from "react";

import { Button, DangerButton, PrimaryButton } from "~/ui/button/Button";
import { useGameMenuControl } from "~/ui/game-menu/useGameMenuControl";
import { useHardResetGameMutation } from "~/ui/game-menu/mutation/useHardResetGameMutation";
import { useSaveAndExitGameMutation } from "~/ui/game-menu/mutation/useSaveAndExitGameMutation";
import { useSaveGameMutation } from "~/ui/game-menu/mutation/useSaveGameMutation";

const focusableSelector = [
	"button:not([disabled])",
	"[href]",
	"input:not([disabled])",
	"select:not([disabled])",
	"textarea:not([disabled])",
	'[tabindex]:not([tabindex="-1"])',
].join(",");

const errorMessage = (error: unknown) => (error instanceof Error ? error.message : String(error));

const GameMenuDialog = ({
	game,
	gameAvailable,
}: {
	readonly game: Game;
	readonly gameAvailable: boolean;
}) => {
	const menu = useGameMenuControl();
	const save = useSaveGameMutation(game);
	const saveAndExit = useSaveAndExitGameMutation(game);
	const hardReset = useHardResetGameMutation(game);
	const [confirmingDestroy, setConfirmingDestroy] = useState(false);
	const dialogRef = useRef<HTMLDivElement>(null);
	const previousFocusRef = useRef<HTMLElement | null>(null);
	const pending = save.isPending || saveAndExit.isPending || hardReset.isPending;
	const gameActionDisabled = pending || !gameAvailable;

	useEffect(() => {
		previousFocusRef.current =
			document.activeElement instanceof HTMLElement ? document.activeElement : null;
		const firstControl = dialogRef.current?.querySelector<HTMLElement>(focusableSelector);
		(firstControl ?? dialogRef.current)?.focus();
		return () => {
			const previousFocus = previousFocusRef.current;
			if (previousFocus?.isConnected === true) {
				previousFocus.focus();
				return;
			}
			document.querySelector<HTMLElement>('[data-ui="GameShell"]')?.focus();
		};
	}, []);

	const keepFocusInside = (event: ReactKeyboardEvent<HTMLDivElement>) => {
		if (event.key === "Escape" && pending) {
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

	const requestSaveAndExit = () => {
		saveAndExit.mutate();
	};

	const requestHardReset = () => {
		void hardReset
			.mutateAsync()
			.then(menu.close)
			.catch(() => undefined);
	};

	const status = hardReset.isPending
		? "Destroying current progress…"
		: saveAndExit.isPending
			? "Saving and exiting Arkini…"
			: save.isPending
				? "Saving…"
				: hardReset.isError
					? `Destroy failed: ${errorMessage(hardReset.error)}`
					: saveAndExit.isError
						? `Save and exit failed: ${errorMessage(saveAndExit.error)}`
						: save.isError
							? `Save failed: ${errorMessage(save.error)}`
							: save.isSuccess
								? "Saved."
								: null;

	return (
		<div
			className="absolute inset-0 z-50 grid place-items-center bg-overlay/90 p-4 text-overlay-foreground backdrop-blur-sm"
			data-ui="GameMenuBackdrop"
		>
			<div
				ref={dialogRef}
				role="dialog"
				aria-modal="true"
				aria-labelledby="game-menu-title"
				className="w-full max-w-sm rounded-2xl border border-line-strong bg-surface-raised p-5 text-foreground shadow-2xl outline-none"
				data-ui="GameMenu"
				tabIndex={-1}
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
						className="w-full py-3"
						disabled={gameActionDisabled}
						onClick={menu.close}
					>
						Return to game
					</PrimaryButton>

					<div className="my-2 border-t border-line" />

					<Button
						className="w-full py-3 shadow-none backdrop-blur-none"
						disabled={gameActionDisabled}
						onClick={() => save.mutate()}
					>
						Save
					</Button>
					<Button
						className="w-full py-3 shadow-none backdrop-blur-none"
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
										disabled={pending}
										onClick={() => setConfirmingDestroy(false)}
									>
										Cancel
									</Button>
									<DangerButton
										className="min-h-0 px-3 py-2 shadow-none"
										disabled={pending}
										onClick={requestHardReset}
									>
										Destroy permanently
									</DangerButton>
								</div>
							</div>
						) : (
							<DangerButton
								className="w-full py-3 shadow-none"
								disabled={pending}
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
			</div>
		</div>
	);
};

/** Renders the active game overlay only while its game-only control is open. */
export const GameMenu = ({
	game,
	gameAvailable = true,
}: {
	readonly game: Game;
	readonly gameAvailable?: boolean;
}) => {
	const { isOpen } = useGameMenuControl();
	return isOpen ? (
		<GameMenuDialog
			game={game}
			gameAvailable={gameAvailable}
		/>
	) : null;
};
