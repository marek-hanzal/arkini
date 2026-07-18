import type { Game } from "~/bridge/game/Game";
import {
	type KeyboardEvent as ReactKeyboardEvent,
	useEffect,
	useLayoutEffect,
	useRef,
	useState,
} from "react";

import { Button, DangerButton, PrimaryButton } from "~/ui/button/Button";
import type { GameMenuPhase } from "~/ui/game-menu/GameMenuControl";
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

const transitionDurationMs = 500;
const transitionEasing = "cubic-bezier(0.22, 1, 0.36, 1)";

const errorMessage = (error: unknown) => (error instanceof Error ? error.message : String(error));

const currentFrame = (element: HTMLElement) => {
	const style = getComputedStyle(element);
	return {
		opacity: style.opacity,
		transform: style.transform === "none" ? "scale(1)" : style.transform,
		filter: style.filter === "none" ? "blur(0px)" : style.filter,
	};
};

const GameMenuDialog = ({
	game,
	gameAvailable,
	phase,
}: {
	readonly game: Game;
	readonly gameAvailable: boolean;
	readonly phase: Exclude<GameMenuPhase, "closed">;
}) => {
	const menu = useGameMenuControl();
	const save = useSaveGameMutation(game);
	const saveAndExit = useSaveAndExitGameMutation(game);
	const hardReset = useHardResetGameMutation(game);
	const [confirmingDestroy, setConfirmingDestroy] = useState(false);
	const backdropRef = useRef<HTMLDivElement>(null);
	const dialogRef = useRef<HTMLDivElement>(null);
	const previousFocusRef = useRef<HTMLElement | null>(null);
	const animationGenerationRef = useRef(0);
	const activeRequestRef = useRef<"save" | "save-and-exit" | "hard-reset" | null>(null);
	const animationsRef = useRef<ReadonlyArray<Animation>>([]);
	const pending = save.isPending || saveAndExit.isPending || hardReset.isPending;
	const exiting = phase === "exiting";
	const gameActionDisabled = pending || exiting || !gameAvailable;

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

	useLayoutEffect(() => {
		if (phase === "open") return;
		const backdrop = backdropRef.current;
		const dialog = dialogRef.current;
		if (backdrop === null || dialog === null) return;

		const generation = animationGenerationRef.current + 1;
		animationGenerationRef.current = generation;
		const backdropCurrent = currentFrame(backdrop);
		const dialogCurrent = currentFrame(dialog);
		for (const animation of animationsRef.current) animation.cancel();

		if (typeof backdrop.animate !== "function" || typeof dialog.animate !== "function") {
			if (phase === "entering") menu.completeEnter();
			else menu.completeExit();
			return;
		}

		const entering = phase === "entering";
		const backdropAnimation = backdrop.animate(
			entering
				? [
						{
							opacity: 0,
						},
						{
							opacity: 1,
						},
					]
				: [
						{
							opacity: backdropCurrent.opacity,
						},
						{
							opacity: 0,
						},
					],
			{
				duration: transitionDurationMs,
				easing: transitionEasing,
				fill: "both",
			},
		);
		const dialogAnimation = dialog.animate(
			entering
				? [
						{
							opacity: 0,
							transform: "scale(0.975) translateY(8px)",
							filter: "blur(6px)",
						},
						{
							opacity: 1,
							transform: "scale(1) translateY(0)",
							filter: "blur(0px)",
						},
					]
				: [
						{
							opacity: dialogCurrent.opacity,
							transform: dialogCurrent.transform,
							filter: dialogCurrent.filter,
						},
						{
							opacity: 0,
							transform: "scale(0.985) translateY(6px)",
							filter: "blur(5px)",
						},
					],
			{
				duration: transitionDurationMs,
				easing: transitionEasing,
				fill: "both",
			},
		);
		animationsRef.current = [
			backdropAnimation,
			dialogAnimation,
		];
		void Promise.all(
			animationsRef.current.map((animation) => animation.finished.catch(() => undefined)),
		).then(() => {
			if (animationGenerationRef.current !== generation) return;
			for (const animation of animationsRef.current) animation.cancel();
			animationsRef.current = [];
			if (phase === "entering") menu.completeEnter();
			else menu.completeExit();
		});
	}, [
		menu,
		phase,
	]);

	useEffect(
		() => () => {
			animationGenerationRef.current += 1;
			for (const animation of animationsRef.current) animation.cancel();
			animationsRef.current = [];
		},
		[],
	);

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

	const requestSave = () => {
		if (activeRequestRef.current !== null) return;
		activeRequestRef.current = "save";
		save.mutate(undefined, {
			onSettled: () => {
				activeRequestRef.current = null;
			},
		});
	};

	const requestSaveAndExit = () => {
		if (activeRequestRef.current !== null) return;
		activeRequestRef.current = "save-and-exit";
		saveAndExit.mutate(undefined, {
			onSettled: () => {
				activeRequestRef.current = null;
			},
		});
	};

	const requestHardReset = () => {
		if (activeRequestRef.current !== null) return;
		activeRequestRef.current = "hard-reset";
		void hardReset
			.mutateAsync()
			.then(() => menu.close())
			.catch(() => undefined)
			.finally(() => {
				activeRequestRef.current = null;
			});
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
			ref={backdropRef}
			className="absolute inset-0 z-50 grid place-items-center bg-overlay/90 p-4 text-overlay-foreground backdrop-blur-sm"
			data-ui="GameMenuBackdrop"
			data-phase={phase}
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
						onClick={() => void menu.close()}
					>
						Return to game
					</PrimaryButton>

					<div className="my-2 border-t border-line" />

					<Button
						className="w-full py-3 shadow-none backdrop-blur-none"
						disabled={gameActionDisabled}
						onClick={requestSave}
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
										disabled={pending || exiting}
										onClick={() => setConfirmingDestroy(false)}
									>
										Cancel
									</Button>
									<DangerButton
										className="min-h-0 px-3 py-2 shadow-none"
										disabled={pending || exiting}
										onClick={requestHardReset}
									>
										Destroy permanently
									</DangerButton>
								</div>
							</div>
						) : (
							<DangerButton
								className="w-full py-3 shadow-none"
								disabled={pending || exiting}
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

/** Renders the active game overlay through one explicit enter/open/exit lifecycle. */
export const GameMenu = ({
	game,
	gameAvailable = true,
}: {
	readonly game: Game;
	readonly gameAvailable?: boolean;
}) => {
	const { phase } = useGameMenuControl();
	return phase === "closed" ? null : (
		<GameMenuDialog
			game={game}
			gameAvailable={gameAvailable}
			phase={phase}
		/>
	);
};
