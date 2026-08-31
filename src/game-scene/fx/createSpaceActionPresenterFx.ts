import { Effect } from "effect";

import type { GameTransition } from "~/game-session/type/GameSession";
import { readSpaceActionPresentationPhasesFn } from "~/game-scene/fn/readSpaceActionPresentationPhasesFn";

type TransitionDelivery = "hydrate" | "present";

interface CreateSpaceActionPresenterProps {
	readonly applyTransitionFn: (transition: GameTransition, delivery: TransitionDelivery) => void;
	readonly initialSequence: number;
	readonly scheduleAfterRenderFn: (workFn: () => void) => () => void;
	readonly setInteractionBlockedFn: (blocked: boolean) => void;
}

/** Sequences source-space accounting, one rendered frame, and the following Space switch. */
export const createSpaceActionPresenterFx = Effect.fn("createSpaceActionPresenterFx")(
	({
		applyTransitionFn,
		initialSequence,
		scheduleAfterRenderFn,
		setInteractionBlockedFn,
	}: CreateSpaceActionPresenterProps) =>
		Effect.sync(() => {
			let closed = false;
			let externalInteractionBlocked = false;
			let spaceSwitchInteractionBlocked = false;
			let awaitingSpaceSwitchProjection = false;
			let cancelSpaceSwitchProjectionFn: () => void = () => undefined;
			let highestAdmittedSequence = initialSequence;
			const queuedTransitions: Array<{
				readonly delivery: TransitionDelivery;
				readonly transition: GameTransition;
			}> = [];
			const syncInteractionBlockFn = () =>
				setInteractionBlockedFn(
					externalInteractionBlocked || spaceSwitchInteractionBlocked,
				);

			const applyAdmittedFn = (transition: GameTransition, delivery: TransitionDelivery) => {
				if (closed) return;
				if (awaitingSpaceSwitchProjection) {
					queuedTransitions.push({
						delivery,
						transition,
					});
					return;
				}
				if (delivery === "hydrate") {
					applyTransitionFn(transition, delivery);
					return;
				}

				const phases = readSpaceActionPresentationPhasesFn(transition);
				const accounting = phases[0];
				const spaceSwitch = phases[1];
				if (accounting?.kind !== "accounting" || spaceSwitch?.kind !== "space-switch") {
					applyTransitionFn(transition, delivery);
					return;
				}

				applyTransitionFn(accounting.transition, delivery);
				spaceSwitchInteractionBlocked = true;
				syncInteractionBlockFn();
				awaitingSpaceSwitchProjection = true;
				cancelSpaceSwitchProjectionFn = scheduleAfterRenderFn(() => {
					if (closed) return;
					awaitingSpaceSwitchProjection = false;
					cancelSpaceSwitchProjectionFn = () => undefined;
					spaceSwitchInteractionBlocked = false;
					syncInteractionBlockFn();
					applyTransitionFn(spaceSwitch.transition, delivery);
					const queued = queuedTransitions.splice(0);
					for (const queuedTransition of queued) {
						applyAdmittedFn(queuedTransition.transition, queuedTransition.delivery);
					}
				});
			};
			const presentFn = (transition: GameTransition, delivery: TransitionDelivery) => {
				if (closed || transition.sequence <= highestAdmittedSequence) return;
				highestAdmittedSequence = transition.sequence;
				applyAdmittedFn(transition, delivery);
			};
			const refreshFn = (transition: GameTransition) => {
				if (closed || transition.sequence < highestAdmittedSequence) return;
				if (transition.sequence > highestAdmittedSequence + 1) return;
				if (transition.sequence === highestAdmittedSequence) {
					const isSpaceSwitch = transition.events.some(
						(event) => event.type === "current-space:changed",
					);
					if (!awaitingSpaceSwitchProjection && !isSpaceSwitch) {
						applyTransitionFn(transition, "present");
					}
					return;
				}
				highestAdmittedSequence = transition.sequence;
				applyAdmittedFn(transition, "present");
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
