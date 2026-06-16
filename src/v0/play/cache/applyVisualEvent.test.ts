import { describe, expect, it, vi } from "vitest";
import { rebuildBoardView } from "~/v0/board/view/rebuildBoardView";
import { rebuildInventoryView } from "~/v0/inventory/view/rebuildInventoryView";
import { ActionVisualAnimation } from "~/v0/play/action/ActionVisualAnimation";
import type { ActionVisualEventSchema } from "~/v0/play/action/ActionVisualEventSchema";
import { applyBoardVisualEvent } from "~/v0/play/cache/applyBoardVisualEvent";
import { applyInventoryVisualEvent } from "~/v0/play/cache/applyInventoryVisualEvent";

const boardView = () =>
	rebuildBoardView([
		{
			id: "source",
			itemId: "item:twig",
			x: 0,
			y: 0,
			state: {},
		},
		{
			id: "target",
			itemId: "item:twig",
			x: 1,
			y: 0,
			state: {},
		},
	]);

const inventoryView = () =>
	rebuildInventoryView([
		{
			slotIndex: 0,
			stack: {
				id: "stack-0",
				itemId: "item:twig",
				quantity: 2,
				state: {},
				stateJson: "{}",
				stateful: false,
			},
		},
		{
			slotIndex: 1,
		},
	]);

describe("applyBoardVisualEvent", () => {
	it("moves board items without rebuilding the whole app state by interpretive dance", () => {
		const event = {
			type: "item.moved",
			itemInstanceId: "source",
			itemId: "item:twig",
			from: {
				kind: "board",
				x: 0,
				y: 0,
			},
			to: {
				kind: "board",
				x: 2,
				y: 3,
			},
		} satisfies ActionVisualEventSchema.Type;

		const next = applyBoardVisualEvent(boardView(), event);

		expect(next.byId.source?.x).toBe(2);
		expect(next.byId.source?.y).toBe(3);
		expect(next.byCellKey["2:3"]?.id).toBe("source");
	});

	it("uses instant fade-in motion for spawned board items", () => {
		const event = {
			type: "item.spawned",
			animation: ActionVisualAnimation.instantFadeIn({
				cause: "producer",
				groupId: "activation:producer:single",
			}),
			itemInstanceId: "spawned",
			itemId: "item:twig",
			to: {
				kind: "board",
				x: 3,
				y: 1,
			},
			reason: "activation-output",
		} satisfies ActionVisualEventSchema.Type;

		const next = applyBoardVisualEvent(boardView(), event);

		expect(next.byId.spawned?.motion?.enter).toMatchObject({
			kind: "fade-in",
		});
	});

	it("consumes merge sources and upgrades the merge target", () => {
		const event = {
			type: "item.merged",
			sourceItemInstanceId: "source",
			sourceItemId: "item:twig",
			targetItemInstanceId: "target",
			targetItemId: "item:twig",
			resultItemId: "item:branch",
			consumeSource: true,
		} satisfies ActionVisualEventSchema.Type;

		const next = applyBoardVisualEvent(boardView(), event);

		expect(next.byId.source).toBeUndefined();
		expect(next.byId.target?.itemId).toBe("item:branch");
		expect(next.items).toHaveLength(1);
	});

	it("starts craft progress deterministically enough for cache patch tests", () => {
		vi.useFakeTimers();
		vi.setSystemTime(1_000);

		const board = rebuildBoardView([
			{
				id: "crafter",
				itemId: "item:lumber-camp-1",
				x: 0,
				y: 0,
				state: {},
				craft: {
					id: "craft:lumber-camp",
					resultItemId: "item:plank",
					durationMs: 1_000,
					inputs: [
						{
							itemId: "item:twig",
							quantity: 1,
						},
					],
					delivered: {},
					inputProgress: 0,
					phase: "collecting_inputs",
					complete: false,
					progress: 0,
					timeProgress: 0,
					canAcceptInputs: true,
					acceptedInputItemIds: [
						"item:twig",
					],
				},
			},
		]);
		const event = {
			type: "craft.started",
			itemInstanceId: "crafter",
			recipeId: "craft:lumber-camp",
			resultItemId: "item:plank",
			readyAtMs: 2_000,
		} satisfies ActionVisualEventSchema.Type;

		const next = applyBoardVisualEvent(board, event);

		expect(next.byId.crafter?.craft?.phase).toBe("waiting");
		expect(next.byId.crafter?.craft?.startedAtMs).toBe(1_000);
		expect(next.byId.crafter?.craft?.remainingMs).toBe(1_000);
		expect(next.byId.crafter?.craft?.canAcceptInputs).toBe(false);

		vi.useRealTimers();
	});
});

describe("applyInventoryVisualEvent", () => {
	it("stacks spawned inventory items into the existing stack", () => {
		const event = {
			type: "item.spawned",
			animation: ActionVisualAnimation.instantFadeIn({
				cause: "producer",
				groupId: "activation:producer:single",
			}),
			itemInstanceId: "spawned",
			itemId: "item:twig",
			to: {
				kind: "inventory",
				slotIndex: 0,
			},
			reason: "activation-output",
		} satisfies ActionVisualEventSchema.Type;

		const next = applyInventoryVisualEvent(inventoryView(), event);

		expect(next.bySlotIndex["0"]?.stack?.id).toBe("stack-0");
		expect(next.bySlotIndex["0"]?.stack?.quantity).toBe(3);
	});

	it("creates an inventory stack when a spawned item lands in an empty slot", () => {
		const event = {
			type: "item.spawned",
			animation: ActionVisualAnimation.instantFadeIn({
				cause: "producer",
				groupId: "activation:producer:single",
			}),
			itemInstanceId: "spawned",
			itemId: "item:branch",
			to: {
				kind: "inventory",
				slotIndex: 1,
			},
			reason: "activation-output",
		} satisfies ActionVisualEventSchema.Type;

		const next = applyInventoryVisualEvent(inventoryView(), event);

		expect(next.bySlotIndex["1"]?.stack).toMatchObject({
			id: "spawned",
			itemId: "item:branch",
			quantity: 1,
			stateJson: "{}",
			stateful: false,
			motion: {
				enter: {
					kind: "fade-in",
				},
			},
		});
	});
});
