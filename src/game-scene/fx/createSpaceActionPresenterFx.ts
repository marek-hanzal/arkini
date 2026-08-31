import { Effect } from "effect";

import type { GameTransition } from "~/game-session/type/GameSession";
import { readSpaceActionPresentationPhasesFn } from "~/game-scene/fn/readSpaceActionPresentationPhasesFn";

type TransitionDelivery = "hydrate" | "present";

interface CreateSpaceActionPresenterProps {
	readonly applyTransition: (transition: GameTransition, delivery: TransitionDelivery) => void;
	readonly initialSequence: number;
	readonly scheduleAfterRender: (work: () => void) => () => void;
	readonly setInteractionBlocked: (blocked: boolean) => void;
}

/** Sequences source-space accounting, one rendered frame, and the following Space switch. */
export const createSpaceActionPresenterFx = Effect.fn("createSpaceActionPresenterFx")(
	({
		applyTransition,
		initialSequence,
		scheduleAfterRender,
		setInteractionBlocked,
	}: CreateSpaceActionPresenterProps) =>
		Effect.sync(() => {
			let closed = false;
			let externalInteractionBlocked = false;
			let spaceSwitchInteractionBlocked = false;
			let awaitingSpaceSwitchProjection = false;
			let cancelSpaceSwitchProjection: () => void = () => undefined;
			let highestAdmittedSequence = initialSequence;
			const queuedTransitions: Array<{
				readonly delivery: TransitionDelivery;
				readonly transition: GameTransition;
			}> = [];
			const syncInteractionBlock = () =>
				setInteractionBlocked(externalInteractionBlocked || spaceSwitchInteractionBlocked);

			const applyAdmitted = (transition: GameTransition, delivery: TransitionDelivery) => {
				if (closed) return;
				if (awaitingSpaceSwitchProjection) {
					queuedTransitions.push({
						delivery,
						transition,
					});
					return;
				}
				if (delivery === "hydrate") {
					applyTransition(transition, delivery);
					return;
				}

				const phases = readSpaceActionPresentationPhasesFn(transition);
				const accounting = phases[0];
				const spaceSwitch = phases[1];
				if (accounting?.kind !== "accounting" || spaceSwitch?.kind !== "space-switch") {
					applyTransition(transition, delivery);
					return;
				}

				applyTransition(accounting.transition, delivery);
				spaceSwitchInteractionBlocked = true;
				syncInteractionBlock();
				awaitingSpaceSwitchProjection = true;
				cancelSpaceSwitchProjection = scheduleAfterRender(() => {
					if (closed) return;
					awaitingSpaceSwitchProjection = false;
					cancelSpaceSwitchProjection = () => undefined;
					spaceSwitchInteractionBlocked = false;
					syncInteractionBlock();
					applyTransition(spaceSwitch.transition, delivery);
					const queued = queuedTransitions.splice(0);
					for (const queuedTransition of queued) {
						applyAdmitted(queuedTransition.transition, queuedTransition.delivery);
					}
				});
			};
			const present = (transition: GameTransition, delivery: TransitionDelivery) => {
				if (closed || transition.sequence <= highestAdmittedSequence) return;
				highestAdmittedSequence = transition.sequence;
				applyAdmitted(transition, delivery);
			};
			const refresh = (transition: GameTransition) => {
				if (closed || transition.sequence < highestAdmittedSequence) return;
				if (transition.sequence > highestAdmittedSequence + 1) return;
				if (transition.sequence === highestAdmittedSequence) {
					const isSpaceSwitch = transition.events.some(
						(event) => event.type === "current-space:changed",
					);
					if (!awaitingSpaceSwitchProjection && !isSpaceSwitch) {
						applyTransition(transition, "present");
					}
					return;
				}
				highestAdmittedSequence = transition.sequence;
				applyAdmitted(transition, "present");
			};

			return {
				present,
				refresh,
				setInteractionBlockedFx: (blocked: boolean) =>
					Effect.sync(() => {
						if (closed) return;
						externalInteractionBlocked = blocked;
						syncInteractionBlock();
					}),
				closeFx: Effect.sync(() => {
					if (closed) return;
					closed = true;
					cancelSpaceSwitchProjection();
					queuedTransitions.length = 0;
				}),
			};
		}),
);
