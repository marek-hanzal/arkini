import { Effect } from "effect";
import { describe, expect, it, vi } from "vitest";

import type { GameEngine } from "~/playable-game/type/GameEngine";
import type { DropItemResult } from "~/item-interaction/type/DropItemResult";
import { createDropSubmissionFx } from "~/tile-interaction/fx/createDropSubmissionFx";
import { startActorExitFx } from "~/tile-rendering/fx/startActorExitFx";
import {
	boardLocation,
	createActor,
	createItem,
	createMotion,
	createReconcilerHarness,
	inventoryLocation,
	projectionProbeState,
	transition,
} from "./createMainReconcilerFx.test/fixture";

describe("main reconciliation / drop settlement", () => {
	it("restores a newer Board identity when its Inventory storage result arrives after its return", () => {
		const source = createItem("runtime:source", boardLocation);
		const actor = createActor(source);
		const harness = createReconcilerHarness({
			actor,
		});
		projectionProbeState.main = [
			source,
		];
		Effect.runSync(harness.reconciler.hydrateFx(transition(0)));
		const generation = Effect.runSync(
			harness.dropPresentation.beginFx({
				sourceActorId: source.id,
				swapCandidate: null,
			}),
		);
		Effect.runSync(
			startActorExitFx({
				actor,
				animator: harness.animator,
			}),
		);
		const stored = createItem(source.id, inventoryLocation, {
			revision: "revision:stored",
		});
		projectionProbeState.main = [];
		projectionProbeState.inventory = [
			stored,
		];
		Effect.runSync(harness.reconciler.reconcileFx(transition(1)));
		const returned = createItem(source.id, boardLocation, {
			revision: "revision:returned",
		});
		projectionProbeState.main = [
			returned,
		];
		projectionProbeState.inventory = [];
		Effect.runSync(harness.reconciler.reconcileFx(transition(2)));
		Effect.runSync(
			harness.dropPresentation.completeFx({
				generation,
				result: {
					kind: "store-inventory",
					source: {
						itemId: source.id,
						canonicalItemId: source.itemId,
						previousRevision: source.revision,
						previousLocation: source.location,
						previousQuantity: source.quantity,
						current: {
							itemId: stored.id,
							canonicalItemId: stored.itemId,
							revision: stored.revision,
							location: stored.location,
							quantity: stored.quantity,
						},
					},
				},
			}),
		);

		Effect.runSync(harness.reconciler.reconcileFx(transition(2)));
		Effect.runSync(harness.reconciler.reconcileFx(transition(3)));

		expect(harness.actors.get(source.id)).toBe(actor);
		expect(actor.item).toBe(returned);
		expect(actor.lifecycleTargetAlpha).toBe(1);
		expect(harness.detached).toEqual([]);
		expect(
			Effect.runSync(harness.dropPresentation.readSnapshotFx).hiddenActorRevisions.size,
		).toBe(0);
	});

	it("retires a source removed while its drop was pending as soon as rejection settles", async () => {
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
				magneticField: {
					closeFx: Effect.void,
					flushFx: Effect.void,
					pruneFx: Effect.void,
					readActiveSourceActorIdsFx: Effect.succeed([]),
					releaseFx: () => Effect.void,
					releaseSourcesFx: () => Effect.void,
					resetFx: Effect.void,
					subscribeSourceMembershipFx: () => Effect.succeed(() => {}),
					updateFx: () => Effect.void,
				},
				motion: createMotion(),
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
				previewKind: "move",
				sourceItem: source,
				targetItem: null,
			}),
		);
		projectionProbeState.main = [];
		Effect.runSync(harness.reconciler.reconcileFx(transition(1)));
		expect(harness.canonicalItems.has(source.id)).toBe(false);
		expect(harness.actors.get(source.id)).toBe(actor);

		resolveDrop({
			kind: "reject",
			reason: "stale-source",
			itemId: source.id,
		});
		await drop;

		expect(Effect.runSync(harness.dropPresentation.readSnapshotFx).pendingActorIds.size).toBe(
			0,
		);
		expect(harness.actors.has(source.id)).toBe(false);
		expect(harness.detached).toEqual([
			actor,
		]);
		expect(onReturnSettledFn).toHaveBeenCalledOnce();
		expect(reportCriticalFailureFn).not.toHaveBeenCalled();
		Effect.runSync(submission.closeFx);
		Effect.runSync(harness.reconciler.closeFx);
	});
});
