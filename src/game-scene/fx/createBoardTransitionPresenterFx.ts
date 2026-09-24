import { Effect } from "effect";
import { match } from "ts-pattern";

import type { GameTransition } from "~/game-session/type/GameSession";
import type { PresentationRuntime } from "~/game-scene/service/PresentationRuntime";
import { RendererRuntime } from "~/application-runtime/service/RendererRuntime";

interface Props {
	readonly applyTransitionFn: (
		transition: GameTransition,
		mode: "hydrate" | "present" | "board-arrive",
	) => void;
	readonly exitVisibleItemsFn: () => void;
	readonly initialTransition: GameTransition;
	readonly presentation: PresentationRuntime;
	readonly readLatestTransitionFn: () => GameTransition;
	readonly scheduleAfterRenderFn: (workFn: () => void) => () => void;
	readonly setInteractionBlockedFn: (blocked: boolean) => void;
}

/** Sequences one visible Board through exit, render barrier, and arrival. */
export const createBoardTransitionPresenterFx = Effect.fn("createBoardTransitionPresenterFx")(
	({
		applyTransitionFn,
		exitVisibleItemsFn,
		initialTransition,
		presentation,
		readLatestTransitionFn,
		scheduleAfterRenderFn,
		setInteractionBlockedFn,
	}: Props) =>
		Effect.sync(() => {
			let closed = false;
			let phase: "visible" | "exiting" | "barrier" | "entering" = "visible";
			let visibleSpace = initialTransition.runtime.currentSpace;
			let highestSequence = initialTransition.sequence;
			let externalBlocked = false;
			let effectiveBlocked = false;
			let pendingReset = false;
			let cancelBarrierFn: () => void = () => undefined;

			const syncBlockFn = () => {
				const blocked = externalBlocked || phase !== "visible";
				if (blocked === effectiveBlocked) return;
				effectiveBlocked = blocked;
				setInteractionBlockedFn(blocked);
			};
			const hasTemplateResetFn = (transition: GameTransition) =>
				transition.events.some(
					(event) =>
						event.type === "board:template-applied" && event.space === visibleSpace,
				);
			const projectVisibleSpaceFn = (transition: GameTransition): GameTransition =>
				transition.runtime.currentSpace === visibleSpace
					? transition
					: {
							...transition,
							runtime: {
								...transition.runtime,
								currentSpace: visibleSpace,
							},
						};
			const finishEnterFn = () => {
				if (closed || phase !== "entering") return;
				phase = "visible";
				const latest = readLatestTransitionFn();
				if (latest.runtime.currentSpace !== visibleSpace || pendingReset) {
					pendingReset = false;
					startExitFn();
					return;
				}
				applyTransitionFn(latest, "hydrate");
				syncBlockFn();
			};
			const enterLatestFn = () => {
				if (closed || phase !== "barrier") return;
				cancelBarrierFn = () => undefined;
				RendererRuntime.runSync(presentation.cancelAllFx);
				const latest = readLatestTransitionFn();
				visibleSpace = latest.runtime.currentSpace;
				pendingReset = false;
				applyTransitionFn(latest, "board-arrive");
				phase = "entering";
				RendererRuntime.runSync(presentation.enterBoardFx(finishEnterFn));
			};
			const finishExitFn = () => {
				if (closed || phase !== "exiting") return;
				phase = "barrier";
				cancelBarrierFn = scheduleAfterRenderFn(enterLatestFn);
			};
			const startExitFn = () => {
				if (closed || phase !== "visible") return;
				phase = "exiting";
				syncBlockFn();
				exitVisibleItemsFn();
				RendererRuntime.runSync(presentation.exitBoardFx(finishExitFn));
			};
			const presentFn = (transition: GameTransition) => {
				if (closed || transition.sequence <= highestSequence) return;
				highestSequence = transition.sequence;
				const reset = hasTemplateResetFn(transition);
				match(phase)
					.with("visible", () => {
						if (transition.runtime.currentSpace !== visibleSpace || reset) {
							pendingReset = reset;
							if (!reset)
								applyTransitionFn(projectVisibleSpaceFn(transition), "hydrate");
							startExitFn();
							return;
						}
						applyTransitionFn(transition, "present");
					})
					.with("exiting", () => {
						if (reset) pendingReset = true;
						// The outgoing Board keeps showing fresh job results until it vanishes.
						if (!pendingReset)
							applyTransitionFn(projectVisibleSpaceFn(transition), "hydrate");
					})
					.with("entering", () => {
						if (reset) pendingReset = true;
						if (pendingReset) return;
						applyTransitionFn(
							projectVisibleSpaceFn(transition),
							transition.runtime.currentSpace === visibleSpace
								? "present"
								: "hydrate",
						);
					})
					.with("barrier", () => {})
					.exhaustive();
			};
			const refreshFn = (transition: GameTransition) => {
				if (closed || transition.sequence < highestSequence) return;
				if (transition.sequence > highestSequence) {
					presentFn(transition);
					return;
				}
				if (phase === "visible" || (phase === "entering" && !pendingReset)) {
					applyTransitionFn(projectVisibleSpaceFn(transition), "hydrate");
				}
			};

			return {
				presentFn,
				refreshFn,
				setInteractionBlockedFx: (blocked: boolean) =>
					Effect.sync(() => {
						if (closed) return;
						externalBlocked = blocked;
						syncBlockFn();
					}),
				closeFx: Effect.sync(() => {
					if (closed) return;
					closed = true;
					cancelBarrierFn();
				}),
			};
		}),
);
