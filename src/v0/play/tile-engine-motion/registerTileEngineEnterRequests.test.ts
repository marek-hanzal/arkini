import { describe, expect, it, afterEach } from "vitest";
import { rebuildBoardView } from "~/v0/board/view/rebuildBoardView";
import { rebuildInventoryView } from "~/v0/inventory/view/rebuildInventoryView";
import { ActionVisualAnimation } from "~/v0/play/action/ActionVisualAnimation";
import type { ActionVisualEventSchema } from "~/v0/play/action/ActionVisualEventSchema";
import { registerTileEngineEnterRequests } from "~/v0/play/tile-engine-motion/registerTileEngineEnterRequests";
import { clearTileEngineMotionRequests, readTileEngineMotionRequests } from "~/v0/tile-engine";

afterEach(() => {
	clearTileEngineMotionRequests();
});

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
			itemId: "item:branch",
			x: 1,
			y: 0,
			state: {},
		},
		{
			id: "spawned",
			itemId: "item:twig",
			x: 2,
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
				quantity: 3,
				state: {},
				stateJson: "{}",
				stateful: false,
			},
		},
	]);

describe("registerTileEngineEnterRequests", () => {
	it("registers board enter requests without writing motion into board cache rows", () => {
		const event = {
			type: "item.spawned",
			animation: ActionVisualAnimation.instantFadeIn({
				cause: "producer",
				groupId: "activation:producer:single",
			}),
			itemInstanceId: "spawned",
			itemId: "item:twig",
			originItemInstanceId: "source",
			to: {
				kind: "board",
				x: 2,
				y: 0,
			},
			reason: "activation-output",
		} satisfies ActionVisualEventSchema.Type;

		registerTileEngineEnterRequests({
			board: boardView(),
			events: [
				event,
			],
			inventory: undefined,
		});

		expect(readTileEngineMotionRequests("board").get("spawned")?.enter).toMatchObject({
			fromTileId: "source",
			groupId: "activation:producer:single",
			kind: "spawn-from-tile",
		});
	});

	it("registers board replacement enter requests against the replaced tile id", () => {
		const event = {
			type: "item.replaced",
			animation: ActionVisualAnimation.replace({
				cause: "craft",
				groupId: "engine:craft-result:target",
			}),
			fromItemId: "item:blueprint",
			itemInstanceId: "target",
			reason: "craft-result",
			toItemId: "item:lumber-camp-1",
		} satisfies ActionVisualEventSchema.Type;

		registerTileEngineEnterRequests({
			board: boardView(),
			events: [
				event,
			],
			inventory: undefined,
		});

		expect(readTileEngineMotionRequests("board").get("target")?.enter).toMatchObject({
			groupId: "engine:craft-result:target",
			kind: "replace-in",
		});
	});

	it("registers inventory enter requests against the rendered stack tile id", () => {
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

		registerTileEngineEnterRequests({
			board: undefined,
			events: [
				event,
			],
			inventory: inventoryView(),
		});

		expect(readTileEngineMotionRequests("inventory").get("stack-0")?.enter).toMatchObject({
			groupId: "activation:producer:single",
			kind: "fade-in",
		});
	});
});
