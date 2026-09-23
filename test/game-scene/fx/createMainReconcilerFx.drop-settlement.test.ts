import { Effect } from "effect";
import { describe, expect, it, vi } from "vitest";

import type { GameEngine } from "~/playable-game/type/GameEngine";
import type { DropItemResult } from "~/item-interaction/type/DropItemResult";
import { createDropSubmissionFx } from "~/tile-interaction/fx/createDropSubmissionFx";
import {
	boardLocation,
	createActor,
	createItem,
	createReconcilerHarness,
	projectionProbeState,
	transition,
} from "./createMainReconcilerFx.test/fixture";

describe("main reconciliation / drop settlement", () => {
	it("does not resurrect a source removed while its drop was pending", async () => {
		const source = createItem("runtime:expired-source", boardLocation);
		const actor = createActor(source);
		const harness = createReconcilerHarness({
			actor,
		});
		projectionProbeState.main = [
			source,
		];
		Effect.runSync(harness.reconciler.hydrateFx(transition(0)));
		let resolveDrop!: (result: DropItemResult) => void;
		const drop = new Promise<DropItemResult>((resolve) => {
			resolveDrop = resolve;
		});
		const reportCriticalFailureFn = vi.fn();
		const onReturnSettledFn = vi.fn();
		const submission = Effect.runSync(
			createDropSubmissionFx({
				actorStore: harness.store,
				animator: harness.animator,
				dropPresentation: harness.dropPresentation,
				cursorGrab: {
					finishFx: () => Effect.void,
					startFx: () => Effect.void,
					closeFx: Effect.void,
				},
				game: {
					reportCriticalFailureFn,
				} as unknown as GameEngine,
				onSettledDropFn: () =>
					Effect.runSync(harness.reconciler.reconcileFx(transition(1))),
				onDropFn: () => drop,
				surface: {
					...harness.surface,
					renderDropFeedbackFx: () => Effect.void,
				},
			}),
		);
		actor.dragging = true;
		Effect.runSync(
			submission.submitFx({
				actor,
				commandTarget: {
					kind: "slot",
					location: {
						...boardLocation,
						position: {
							x: 1,
							y: 0,
						},
					},
					occupant: null,
				},
				onReturnSettledFn,
				sourceItem: source,
			}),
		);
		projectionProbeState.main = [];
		Effect.runSync(harness.reconciler.reconcileFx(transition(1)));
		expect(harness.canonicalItems.has(source.id)).toBe(false);
		expect(harness.actors.has(source.id)).toBe(false);
		expect(harness.disappears).toHaveLength(1);
		expect(actor.container.destroyed).toBe(false);
		expect(harness.detached).toEqual([
			actor,
		]);

		resolveDrop({
			kind: "reject",
			reason: "stale-source",
			itemId: source.id,
		});
		await drop;

		expect(Effect.runSync(harness.dropPresentation.isPendingActorFx(source.id))).toBe(false);
		expect(harness.actors.has(source.id)).toBe(false);
		expect(harness.detached).toEqual([
			actor,
		]);
		expect(onReturnSettledFn).toHaveBeenCalledOnce();
		expect(reportCriticalFailureFn).not.toHaveBeenCalled();
		harness.disappears[0]?.onCompleteFn?.();
		expect(actor.container.destroyed).toBe(true);
		Effect.runSync(submission.closeFx);
		Effect.runSync(harness.reconciler.closeFx);
	});
});
