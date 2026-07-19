import { useNavigate } from "@tanstack/react-router";
import {
	useCallback,
	useEffect,
	type RefObject,
	useLayoutEffect,
	useRef,
	useState,
	useSyncExternalStore,
} from "react";
import { RendererRuntime } from "~/bridge/runtime/RendererRuntime";
import { PrimaryButton } from "~/ui/button/Button";
import { LauncherHero } from "~/ui/launcher/LauncherHero";
import { LauncherScene } from "~/ui/launcher/LauncherScene";
import { useLauncherStartup } from "~/ui/launcher/useLauncherStartup";

const blackHoldMs = 500;
const minimumSplashMs = 5_000;
const enterTransitionMs = 1_500;
const exitTransitionMs = 1_500;

type SplashPhase = "black" | "entering" | "open" | "exiting" | "completed";

const messageFromError = (error: unknown) =>
	error instanceof Error ? error.message : String(error);

const currentFrame = (element: HTMLElement) => {
	const style = getComputedStyle(element);
	return {
		opacity: style.opacity,
		transform: style.transform === "none" ? "scale(1)" : style.transform,
	};
};

const numericOpacity = (element: HTMLElement) => {
	const opacity = Number.parseFloat(getComputedStyle(element).opacity);
	return Number.isFinite(opacity) ? opacity : 1;
};

interface HeroHandoffState {
	readonly destination: HTMLElement;
	readonly destinationVisibility: string;
	readonly source: HTMLElement;
	readonly sourceVisibility: string;
}

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

interface StartupSplashProps {
	readonly mainMenuRef: RefObject<HTMLDivElement | null>;
}

/** Runs the visible-window black hold, decoded Hero reveal and real main-menu cross-fade. */
export const StartupSplash = ({ mainMenuRef }: StartupSplashProps) => {
	const startup = useLauncherStartup();
	const state = useSyncExternalStore(startup.subscribe, startup.getSnapshot, startup.getSnapshot);
	const navigate = useNavigate();
	const [visibleAtMs, setVisibleAtMs] = useState<number | null>(null);
	const [blackHoldComplete, setBlackHoldComplete] = useState(false);
	const [minimumSplashComplete, setMinimumSplashComplete] = useState(false);
	const [phase, setPhase] = useState<SplashPhase>("black");
	const overlayRef = useRef<HTMLDivElement>(null);
	const heroHandoffRef = useRef<HTMLDivElement>(null);
	const heroHandoffStateRef = useRef<HeroHandoffState | null>(null);
	const animationsRef = useRef<ReadonlyArray<Animation>>([]);
	const animationGenerationRef = useRef(0);
	const visualReady = state.appearance !== null && state.heroReady;
	const canExit = state.type === "ready" && (phase === "entering" || phase === "open");
	const canContinue = canExit && !minimumSplashComplete;

	useEffect(() => {
		let active = true;
		void window.arkini.lifecycle
			.waitUntilVisible()
			.then((nextVisibleAtMs) => {
				if (active) setVisibleAtMs(nextVisibleAtMs);
			})
			.catch(() => undefined);
		return () => {
			active = false;
		};
	}, []);

	useEffect(() => {
		if (visibleAtMs === null) return;
		const remainingMs = Math.max(0, blackHoldMs - (performance.now() - visibleAtMs));
		const timer = window.setTimeout(() => setBlackHoldComplete(true), remainingMs);
		return () => window.clearTimeout(timer);
	}, [
		visibleAtMs,
	]);

	useEffect(() => {
		if (visibleAtMs === null) return;
		const remainingMs = Math.max(0, minimumSplashMs - (performance.now() - visibleAtMs));
		const timer = window.setTimeout(() => setMinimumSplashComplete(true), remainingMs);
		return () => window.clearTimeout(timer);
	}, [
		visibleAtMs,
	]);

	useEffect(() => {
		if (phase !== "black" || !blackHoldComplete || !visualReady) return;
		setPhase("entering");
	}, [
		blackHoldComplete,
		phase,
		visualReady,
	]);

	const requestExit = useCallback(() => {
		if (!canExit) return;
		setPhase("exiting");
	}, [
		canExit,
	]);

	useEffect(() => {
		if (!minimumSplashComplete || !canExit) return;
		requestExit();
	}, [
		canExit,
		minimumSplashComplete,
		requestExit,
	]);

	useEffect(() => {
		const onKeyDown = (event: KeyboardEvent) => {
			if (event.key !== "Escape" || !canContinue) return;
			event.preventDefault();
			requestExit();
		};
		window.addEventListener("keydown", onKeyDown);
		return () => window.removeEventListener("keydown", onKeyDown);
	}, [
		canContinue,
		requestExit,
	]);

	useLayoutEffect(() => {
		if (phase !== "entering" && phase !== "exiting") return;
		const overlay = overlayRef.current;
		const mainMenu = mainMenuRef.current;
		if (overlay === null) return;
		const generation = animationGenerationRef.current + 1;
		animationGenerationRef.current = generation;
		const frame = currentFrame(overlay);
		const entering = phase === "entering";
		const sourceHero = entering
			? null
			: overlay.querySelector<HTMLElement>('[data-ui="LauncherHero"]');
		const destinationHero = entering
			? null
			: (mainMenu?.querySelector<HTMLElement>('[data-ui="LauncherHero"]') ?? null);
		const handoffHero = entering ? null : heroHandoffRef.current;
		const sourceRect = sourceHero?.getBoundingClientRect();
		const destinationRect = destinationHero?.getBoundingClientRect();
		const sourceOpacity =
			sourceHero === null ? 1 : numericOpacity(overlay) * numericOpacity(sourceHero);

		for (const animation of animationsRef.current) animation.cancel();
		animationsRef.current = [];

		const canAnimateExit =
			mainMenu !== null &&
			typeof mainMenu.animate === "function" &&
			sourceHero !== null &&
			destinationHero !== null &&
			handoffHero !== null &&
			typeof handoffHero.animate === "function" &&
			sourceRect !== undefined &&
			destinationRect !== undefined;

		if (typeof overlay.animate !== "function" || (!entering && !canAnimateExit)) {
			if (entering) {
				setPhase("open");
			} else {
				if (mainMenu !== null) mainMenu.style.opacity = "1";
				setPhase("completed");
			}
			return;
		}

		const easing = entering
			? "cubic-bezier(0.22, 1, 0.36, 1)"
			: "cubic-bezier(0.64, 0, 0.78, 0)";
		const options: KeyframeAnimationOptions = {
			duration: entering ? enterTransitionMs : exitTransitionMs,
			easing,
			fill: "both",
		};
		const splashAnimation = overlay.animate(
			entering
				? [
						{
							opacity: 0,
							transform: "scale(0.985)",
						},
						{
							opacity: 1,
							transform: "scale(1)",
						},
					]
				: [
						frame,
						{
							opacity: 0,
							transform: "scale(1.01)",
						},
					],
			options,
		);
		const animations: Array<Animation> = [
			splashAnimation,
		];
		let successfulHandoff: HeroHandoffState | null = null;

		if (
			!entering &&
			mainMenu !== null &&
			sourceHero !== null &&
			destinationHero !== null &&
			handoffHero !== null &&
			sourceRect !== undefined &&
			destinationRect !== undefined
		) {
			const handoffState: HeroHandoffState = {
				destination: destinationHero,
				destinationVisibility: destinationHero.style.visibility,
				source: sourceHero,
				sourceVisibility: sourceHero.style.visibility,
			};
			heroHandoffStateRef.current = handoffState;
			sourceHero.style.visibility = "hidden";
			destinationHero.style.visibility = "hidden";
			Object.assign(handoffHero.style, {
				height: `${sourceRect.height}px`,
				left: `${sourceRect.left}px`,
				opacity: String(sourceOpacity),
				top: `${sourceRect.top}px`,
				visibility: "visible",
				width: `${sourceRect.width}px`,
			});
			const scaleX = sourceRect.width === 0 ? 1 : destinationRect.width / sourceRect.width;
			const scaleY = sourceRect.height === 0 ? 1 : destinationRect.height / sourceRect.height;
			const translateX = destinationRect.left - sourceRect.left;
			const translateY = destinationRect.top - sourceRect.top;

			animations.push(
				mainMenu.animate(
					[
						{
							opacity: 0,
						},
						{
							opacity: 1,
						},
					],
					options,
				),
				handoffHero.animate(
					[
						{
							opacity: sourceOpacity,
							transform: "translate(0px, 0px) scale(1, 1)",
						},
						{
							opacity: 1,
							transform: `translate(${translateX}px, ${translateY}px) scale(${scaleX}, ${scaleY})`,
						},
					],
					options,
				),
			);
			successfulHandoff = handoffState;
		}

		animationsRef.current = animations;
		void Promise.all(
			animations.map((animation) => animation.finished.catch(() => undefined)),
		).then(() => {
			if (animationGenerationRef.current !== generation) return;
			animationsRef.current = animations.filter((animation) => !persistFinalFrame(animation));
			if (entering) {
				setPhase("open");
				return;
			}
			if (successfulHandoff !== null && handoffHero !== null) {
				successfulHandoff.destination.style.visibility =
					successfulHandoff.destinationVisibility;
				successfulHandoff.source.style.visibility = "hidden";
				handoffHero.style.visibility = "hidden";
				heroHandoffStateRef.current = null;
			}
			setPhase("completed");
		});
	}, [
		mainMenuRef,
		phase,
	]);

	useEffect(() => {
		if (phase !== "completed") return;
		void RendererRuntime.runPromise(startup.completeSplashFx).then(() =>
			navigate({
				to: "/main-menu",
			}),
		);
	}, [
		navigate,
		phase,
		startup,
	]);

	useEffect(
		() => () => {
			animationGenerationRef.current += 1;
			for (const animation of animationsRef.current) animation.cancel();
			animationsRef.current = [];
			const handoffState = heroHandoffStateRef.current;
			if (handoffState !== null) {
				if (handoffState.source.isConnected) {
					handoffState.source.style.visibility = handoffState.sourceVisibility;
				}
				if (handoffState.destination.isConnected) {
					handoffState.destination.style.visibility = handoffState.destinationVisibility;
				}
			}
			const handoffHero = heroHandoffRef.current;
			if (handoffHero !== null) handoffHero.style.visibility = "hidden";
			heroHandoffStateRef.current = null;
		},
		[],
	);

	const retry = () => {
		void RendererRuntime.runPromise(startup.retryFx).catch(() => undefined);
	};

	if (phase === "completed") return null;

	if (!blackHoldComplete || (!visualReady && state.type !== "failed")) {
		return (
			<main
				className="absolute inset-0 z-20 size-full bg-black"
				data-ui="StartupBlackHold"
			/>
		);
	}

	if (state.type === "failed" && !visualReady) {
		return (
			<main
				className="absolute inset-0 z-20 grid size-full place-items-center bg-black p-6 text-white"
				data-ui="StartupFailure"
			>
				<div className="grid max-w-lg gap-3 rounded-2xl border border-danger/35 bg-surface/85 p-4 text-center text-foreground shadow-xl backdrop-blur-md">
					<p className="font-semibold text-danger">Startup failed</p>
					<p>{messageFromError(state.error)}</p>
					<PrimaryButton
						className="mx-auto"
						onClick={retry}
					>
						Retry
					</PrimaryButton>
				</div>
			</main>
		);
	}

	return (
		<>
			<div
				ref={heroHandoffRef}
				className="pointer-events-none fixed left-0 top-0 z-30 invisible origin-top-left"
				aria-hidden="true"
				data-ui="StartupHeroHandoff"
				style={{
					transformOrigin: "top left",
					willChange: "transform, opacity",
				}}
			>
				<LauncherHero
					style={{
						width: "100%",
					}}
				/>
			</div>
			<div
				ref={overlayRef}
				className="absolute inset-0 z-20 size-full"
				data-ui="StartupSplash"
				data-phase={phase}
				style={
					phase === "entering"
						? {
								opacity: 0,
								transform: "scale(0.985)",
							}
						: undefined
				}
			>
				<LauncherScene dataUi="StartupSplashScene">
					<div
						className="min-h-14 text-center text-sm text-muted"
						aria-live="polite"
					>
						{state.type === "loading" ? (
							<p>Preparing Arkini…</p>
						) : state.type === "failed" ? (
							<div className="mx-auto grid max-w-lg gap-3 rounded-2xl border border-danger/35 bg-surface/85 p-4 shadow-xl backdrop-blur-md">
								<p className="font-semibold text-danger">Startup failed</p>
								<p>{messageFromError(state.error)}</p>
								<PrimaryButton
									className="mx-auto"
									onClick={retry}
								>
									Retry
								</PrimaryButton>
							</div>
						) : canContinue ? (
							<p className="animate-pulse text-xs font-semibold uppercase tracking-[0.24em] text-subtle">
								Press Esc to continue
							</p>
						) : null}
					</div>
				</LauncherScene>
			</div>
		</>
	);
};
