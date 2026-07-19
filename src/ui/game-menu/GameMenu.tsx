import { useNavigate } from "@tanstack/react-router";
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
import { useSaveAndExitGameMutation } from "~/ui/game-menu/mutation/useSaveAndExitGameMutation";
import { useSaveGameMutation } from "~/ui/game-menu/mutation/useSaveGameMutation";
import { mainPagePanelViewTransitionName } from "~/ui/navigation/mainPagePanelViewTransitionName";

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

const persistFinalFrame = (animation: Animation) => {
	if (typeof animation.commitStyles !== "function") return false;
	try {
		animation.commitStyles();
		animation.cancel();
		return true;
	} catch {
		return false;
	}
};

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
	const backdropRef = useRef<HTMLDivElement>(null);
	const dialogRef = useRef<HTMLDivElement>(null);
	const previousFocusRef = useRef<HTMLElement | null>(null);
	const animationGenerationRef = useRef(0);
	const activeRequestRef = useRef<
		"save" | "save-and-exit" | "hard-reset" | "main-menu" | "settings" | null
	>(null);
	const animationsRef = useRef<ReadonlyArray<Animation>>([]);
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
			animationsRef.current = animationsRef.current.filter(
				(animation) => !persistFinalFrame(animation),
			);
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

	const requestRoute = (destination: "/settings" | "/main-menu") => {
		if (activeRequestRef.current !== null || !menu.beginRouteRequest()) return;
		activeRequestRef.current = destination === "/settings" ? "settings" : "main-menu";
		setNavigationError(undefined);
		const request = navigate({
			to: destination,
		});
		void request.catch(setNavigationError).finally(() => {
			activeRequestRef.current = null;
			menu.completeRouteRequest();
		});
	};

	const requestSettings = () => requestRoute("/settings");
	const requestMainMenu = () => requestRoute("/main-menu");

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
		<div
			ref={backdropRef}
			className="absolute inset-0 z-50 grid place-items-center overflow-hidden bg-overlay/90 p-[var(--ak-viewport-padding)] text-overlay-foreground backdrop-blur-sm"
			data-ui="GameMenuBackdrop"
			data-phase={phase}
			style={
				phase === "entering"
					? {
							opacity: 0,
						}
					: undefined
			}
		>
			<div
				ref={dialogRef}
				role="dialog"
				aria-modal="true"
				aria-labelledby="game-menu-title"
				className="max-h-full w-full max-w-sm overflow-y-auto rounded-2xl border border-line-strong bg-surface-raised p-[var(--ak-panel-padding)] text-foreground shadow-2xl outline-none"
				data-ui="GameMenu"
				tabIndex={-1}
				style={{
					viewTransitionName: mainPagePanelViewTransitionName,
					...(phase === "entering"
						? {
								opacity: 0,
								transform: "scale(0.975) translateY(8px)",
								filter: "blur(6px)",
							}
						: {}),
				}}
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
			</div>
		</div>
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
