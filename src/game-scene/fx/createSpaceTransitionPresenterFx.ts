import { Effect } from "effect";

import type { GameTransition } from "~/game-session/type/GameSession";
import { readSpaceTransitionPresentationPhasesFn } from "~/game-scene/fn/readSpaceTransitionPresentationPhasesFn";

interface CreateSpaceTransitionPresenterProps {
	readonly applyTransitionFn: (transition: GameTransition, mode?: "hydrate" | "present") => void;
	readonly initialSequence: number;
	readonly scheduleAfterRenderFn: (workFn: () => void) => () => void;
	readonly setInteractionBlockedFn: (blocked: boolean) => void;
}

/** Sequences source-space accounting, one rendered frame, and the following Space switch. */
export const createSpaceTransitionPresenterFx = Effect.fn("createSpaceTransitionPresenterFx")(
	({
		applyTransitionFn,
		initialSequence,
		scheduleAfterRenderFn,
		setInteractionBlockedFn,
	}: CreateSpaceTransitionPresenterProps) =>
		Effect.sync(() => {
			let closed = false;
			let externalInteractionBlocked = false;
			let spaceSwitchInteractionBlocked = false;
			let awaitingSpaceSwitchProjection = false;
			let cancelSpaceSwitchProjectionFn: () => void = () => undefined;
			let highestAdmittedSequence = initialSequence;
			const queuedTransitions: GameTransition[] = [];
			const syncInteractionBlockFn = () =>
				setInteractionBlockedFn(
					externalInteractionBlocked || spaceSwitchInteractionBlocked,
				);

			const applyAdmittedFn = (transition: GameTransition) => {
				if (closed) return;
				if (awaitingSpaceSwitchProjection) {
					queuedTransitions.push(transition);
					return;
				}

				const phases = readSpaceTransitionPresentationPhasesFn(transition);
				const accounting = phases[0];
				const spaceSwitch = phases[1];
				if (accounting?.kind !== "accounting" || spaceSwitch?.kind !== "space-switch") {
					applyTransitionFn(transition);
					return;
				}

				applyTransitionFn(accounting.transition);
				spaceSwitchInteractionBlocked = true;
				syncInteractionBlockFn();
				awaitingSpaceSwitchProjection = true;
				cancelSpaceSwitchProjectionFn = scheduleAfterRenderFn(() => {
					if (closed) return;
					awaitingSpaceSwitchProjection = false;
					cancelSpaceSwitchProjectionFn = () => undefined;
					spaceSwitchInteractionBlocked = false;
					syncInteractionBlockFn();
					applyTransitionFn(spaceSwitch.transition);
					const queued = queuedTransitions.splice(0);
					for (const queuedTransition of queued) {
						applyAdmittedFn(queuedTransition);
					}
				});
			};
			const presentFn = (transition: GameTransition) => {
				if (closed || transition.sequence <= highestAdmittedSequence) return;
				highestAdmittedSequence = transition.sequence;
				applyAdmittedFn(transition);
			};
			const refreshFn = (transition: GameTransition) => {
				if (closed || transition.sequence < highestAdmittedSequence) return;
				if (transition.sequence > highestAdmittedSequence + 1) return;
				if (transition.sequence === highestAdmittedSequence) {
					const isSpaceSwitch = transition.events.some(
						(event) => event.type === "current-space:changed",
					);
					if (!awaitingSpaceSwitchProjection) {
						// A settled drop still needs actor reconciliation after the Space frame barrier.
						// Replaying the Space event would present the switch and its cues twice.
						applyTransitionFn(transition, isSpaceSwitch ? "hydrate" : "present");
					}
					return;
				}
				highestAdmittedSequence = transition.sequence;
				applyAdmittedFn(transition);
			};

			return {
				presentFn,
				refreshFn,
				setInteractionBlockedFx: (blocked: boolean) =>
					Effect.sync(() => {
						if (closed) return;
						externalInteractionBlocked = blocked;
						syncInteractionBlockFn();
					}),
				closeFx: Effect.sync(() => {
					if (closed) return;
					closed = true;
					cancelSpaceSwitchProjectionFn();
					queuedTransitions.length = 0;
				}),
			};
		}),
);
