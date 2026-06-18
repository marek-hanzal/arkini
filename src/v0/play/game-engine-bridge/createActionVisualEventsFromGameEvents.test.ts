import { describe, expect, it } from "vitest";
import type { GameEvent } from "~/v0/game/engine/model/GameEventSchema";
import { createActionVisualEventsFromGameEvents } from "~/v0/play/game-engine-bridge/createActionVisualEventsFromGameEvents";

const map = (events: readonly GameEvent[]) =>
	createActionVisualEventsFromGameEvents({
		events,
	});

describe("createActionVisualEventsFromGameEvents", () => {
	it("maps board item creation to sequenced spawn visuals", () => {
		const visualEvents = map([
			{
				itemId: "item:twig",
				originItemInstanceId: "producer-1",
				reason: "product-output",
				to: {
					kind: "board",
					itemInstanceId: "spawn-1",
					x: 1,
					y: 2,
				},
				type: "item.created",
			},
			{
				itemId: "item:branch",
				originItemInstanceId: "producer-1",
				reason: "product-output",
				to: {
					kind: "board",
					itemInstanceId: "spawn-2",
					x: 2,
					y: 2,
				},
				type: "item.created",
			},
		]);

		expect(visualEvents).toMatchObject([
			{
				animation: {
					cause: "producer",
					mode: "sequence",
					sequenceIndex: 0,
				},
				itemInstanceId: "spawn-1",
				reason: "product-output",
				type: "item.spawned",
			},
			{
				animation: {
					cause: "producer",
					mode: "sequence",
					sequenceIndex: 1,
				},
				itemInstanceId: "spawn-2",
				reason: "product-output",
				type: "item.spawned",
			},
		]);
	});

	it("maps stash board output to sequenced spawn visuals", () => {
		const visualEvents = map([
			{
				itemId: "item:twig",
				originItemInstanceId: "stash-1",
				reason: "stash-output",
				to: {
					kind: "board",
					itemInstanceId: "spawn-1",
					x: 1,
					y: 0,
				},
				type: "item.created",
			},
			{
				itemId: "item:twig",
				originItemInstanceId: "stash-1",
				reason: "stash-output",
				to: {
					kind: "board",
					itemInstanceId: "spawn-2",
					x: 0,
					y: 1,
				},
				type: "item.created",
			},
		]);

		expect(visualEvents).toMatchObject([
			{
				animation: {
					cause: "stash",
					mode: "sequence",
					sequenceIndex: 0,
				},
				itemInstanceId: "spawn-1",
				reason: "stash-output",
				type: "item.spawned",
			},
			{
				animation: {
					cause: "stash",
					mode: "sequence",
					sequenceIndex: 1,
				},
				itemInstanceId: "spawn-2",
				reason: "stash-output",
				type: "item.spawned",
			},
		]);
	});

	it("maps inventory creation and consumption to quantity patch visuals", () => {
		const visualEvents = map([
			{
				itemId: "item:twig",
				reason: "stash-output",
				to: {
					kind: "inventory",
					nextQuantity: 4,
					previousQuantity: 2,
					quantity: 2,
					slotIndex: 0,
				},
				type: "item.created",
			},
			{
				from: {
					kind: "inventory",
					nextQuantity: 1,
					previousQuantity: 4,
					quantity: 3,
					slotIndex: 0,
				},
				itemId: "item:twig",
				reason: "product-input",
				type: "item.consumed",
			},
		]);

		expect(visualEvents).toMatchObject([
			{
				itemId: "item:twig",
				nextQuantity: 4,
				previousQuantity: 2,
				reason: "stash-output",
				slotIndex: 0,
				type: "inventory.quantity_changed",
			},
			{
				itemId: "item:twig",
				nextQuantity: 1,
				previousQuantity: 4,
				reason: "product-input",
				slotIndex: 0,
				type: "inventory.quantity_changed",
			},
		]);
	});

	it("folds merge source consumption and target replacement into one merge visual", () => {
		const visualEvents = map([
			{
				from: {
					kind: "board",
					itemInstanceId: "source-1",
				},
				itemId: "item:twig",
				reason: "merge-source",
				type: "item.consumed",
			},
			{
				fromItemId: "item:twig",
				itemInstanceId: "target-1",
				reason: "merge-result",
				replacedAtMs: 100,
				toItemId: "item:plank",
				type: "item.replaced",
			},
		]);

		expect(visualEvents).toMatchObject([
			{
				consumeSource: true,
				resultItemId: "item:plank",
				sourceItemInstanceId: "source-1",
				sourceItemId: "item:twig",
				targetItemInstanceId: "target-1",
				targetItemId: "item:twig",
				type: "item.merged",
			},
		]);
	});

	it("keeps standalone replacements representable when no merge source event exists", () => {
		const visualEvents = map([
			{
				fromItemId: "item:blueprint",
				itemInstanceId: "target-1",
				reason: "merge-result",
				replacedAtMs: 100,
				toItemId: "item:blueprint-lumber-camp",
				type: "item.replaced",
			},
		]);

		expect(visualEvents).toMatchObject([
			{
				fromItemId: "item:blueprint",
				itemInstanceId: "target-1",
				reason: "merge-result",
				toItemId: "item:blueprint-lumber-camp",
				type: "item.replaced",
			},
		]);
	});

	it("maps craft result replacement to a craft replacement visual", () => {
		const visualEvents = map([
			{
				fromItemId: "item:blueprint",
				itemInstanceId: "target-1",
				reason: "craft-result",
				replacedAtMs: 100,
				toItemId: "item:lumber-camp-1",
				type: "item.replaced",
			},
		]);

		expect(visualEvents).toMatchObject([
			{
				animation: {
					cause: "craft",
					effect: "replace",
					groupId: "engine:craft-result:target-1",
				},
				fromItemId: "item:blueprint",
				itemInstanceId: "target-1",
				reason: "craft-result",
				toItemId: "item:lumber-camp-1",
				type: "item.replaced",
			},
		]);
	});

	it("maps stash opened events to activation state visuals", () => {
		const visualEvents = map([
			{
				openedAtMs: 100,
				remainingCharges: 0,
				stashId: "stash:test",
				stashItemInstanceId: "stash-1",
				type: "stash.opened",
			},
		]);

		expect(visualEvents).toMatchObject([
			{
				itemInstanceId: "stash-1",
				mode: "exhaust",
				type: "activation.activated",
			},
		]);
	});
	it("maps atomic stash output and depletion in one visual batch", () => {
		const visualEvents = map([
			{
				openedAtMs: 100,
				remainingCharges: 0,
				stashId: "stash:test",
				stashItemInstanceId: "stash-1",
				type: "stash.opened",
			},
			{
				itemId: "item:twig",
				originItemInstanceId: "stash-1",
				reason: "stash-output",
				to: {
					kind: "board",
					itemInstanceId: "spawn-1",
					x: 1,
					y: 0,
				},
				type: "item.created",
			},
			{
				depletedAtMs: 100,
				stashId: "stash:test",
				stashItemInstanceId: "stash-1",
				type: "stash.depleted",
			},
			{
				itemId: "item:stash",
				itemInstanceId: "stash-1",
				reason: "stash-depleted",
				removedAtMs: 100,
				type: "item.removed",
			},
		]);

		expect(visualEvents).toMatchObject([
			{
				itemInstanceId: "stash-1",
				mode: "exhaust",
				type: "activation.activated",
			},
			{
				animation: {
					cause: "stash",
					mode: "sequence",
				},
				itemInstanceId: "spawn-1",
				reason: "stash-output",
				type: "item.spawned",
			},
			{
				itemInstanceId: "stash-1",
				type: "activation.depleted",
			},
		]);
	});
});
