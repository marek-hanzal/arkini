import { describe, expect, it } from "vitest";
import { createEngineTestConfig } from "~/v0/game/engine/test/createEngineTestConfig";
import {
	findBoardItem,
	runAction,
	runInitialSave,
} from "~/v0/game/engine/applyGameActionFx.testSupport";

const createRealtimeDurationConfig = ({ sourceX }: { sourceX: number }) => {
	const baseConfig = createEngineTestConfig();
	return createEngineTestConfig({
		effects: {
			"effect:nearby-speed": {
				name: "Nearby speed",
				operations: [
					{
						kind: "duration.multiply",
						multiplier: 0.1,
						target: {
							productIds: [
								"product:test",
							],
						},
					},
				],
				radius: 1,
				scope: "local",
			},
		},
		game: {
			...baseConfig.game,
			board: {
				height: 1,
				width: 3,
			},
		},
		items: {
			...baseConfig.items,
			"item:axe": {
				...baseConfig.items["item:axe"],
				passiveEffectIds: [
					"effect:nearby-speed",
				],
			},
		},
		products: {
			...baseConfig.products,
			"product:test": {
				...baseConfig.products["product:test"],
				durationMs: 1000,
				output: [
					{
						itemId: "item:twig",
						quantity: 1,
						type: "guaranteed",
					},
				],
			},
		},
		startingState: {
			...baseConfig.startingState,
			board: [
				{
					itemId: "item:producer",
					x: 0,
					y: 0,
				},
				{
					itemId: "item:axe",
					x: sourceX,
					y: 0,
				},
			],
		},
	});
};

const startProducer = ({ config, nowMs, save }: Parameters<typeof runAction>[0]) =>
	runAction({
		config,
		nowMs,
		save,
		action: {
			inputRefs: [],
			producerItemInstanceId: "item-instance:1",
			productId: "product:test",
			type: "producer.product.start",
		},
	});

describe("realtime producer effects", () => {
	it("extends a running producer job when a local duration source leaves proximity", () => {
		const config = createRealtimeDurationConfig({
			sourceX: 1,
		});
		const initialSave = runInitialSave({
			config,
			nowMs: 0,
		});
		const started = startProducer({
			config,
			nowMs: 0,
			save: initialSave,
			action: null,
		});
		const jobId = Object.keys(started.save.producerJobs)[0] as string;
		expect(started.save.producerJobs[jobId]).toMatchObject({
			readyAtMs: 100,
			startAtMs: 0,
		});

		const source = findBoardItem(started.save, {
			itemId: "item:axe",
			x: 1,
			y: 0,
		});
		expect(source).toBeDefined();

		const moved = runAction({
			config,
			nowMs: 50,
			save: started.save,
			action: {
				boardItemId: source?.id ?? "missing",
				type: "board.item.move",
				x: 2,
				y: 0,
			},
		});

		expect(moved.events).not.toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					type: "product.completed",
				}),
			]),
		);
		expect(moved.save.producerJobs[jobId]).toMatchObject({
			readyAtMs: 1000,
			startAtMs: 0,
		});
		expect(moved.nextWakeAtMs).toBe(1000);
	});

	it("completes a running producer job immediately when a local duration source enters proximity", () => {
		const config = createRealtimeDurationConfig({
			sourceX: 2,
		});
		const initialSave = runInitialSave({
			config,
			nowMs: 0,
		});
		const started = startProducer({
			config,
			nowMs: 0,
			save: initialSave,
			action: null,
		});
		const jobId = Object.keys(started.save.producerJobs)[0] as string;
		expect(started.save.producerJobs[jobId]).toMatchObject({
			readyAtMs: 1000,
			startAtMs: 0,
		});

		const source = findBoardItem(started.save, {
			itemId: "item:axe",
			x: 2,
			y: 0,
		});
		expect(source).toBeDefined();

		const moved = runAction({
			config,
			nowMs: 500,
			save: started.save,
			action: {
				boardItemId: source?.id ?? "missing",
				type: "board.item.move",
				x: 1,
				y: 0,
			},
		});

		expect(moved.save.producerJobs[jobId]).toBeUndefined();
		expect(moved.events).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					jobId,
					type: "product.completed",
				}),
				expect.objectContaining({
					itemId: "item:twig",
					type: "item.created",
				}),
			]),
		);
	});
});
