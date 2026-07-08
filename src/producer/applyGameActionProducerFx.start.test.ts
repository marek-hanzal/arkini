import { describe, expect, it } from "vitest";
import {
	appendFirstOutputEffects,
	createEngineTestConfig,
	findBoardItem,
	readOnlyRecordValue,
	runAction,
	runActionEither,
	runInitialSave,
} from "./applyGameActionProducerFx.testSupport";

describe("applyGameActionFx Producer start", () => {
	it("starts a no-input line as an Effect action", () => {
		const config = createEngineTestConfig();
		const save = runInitialSave({
			config,
			nowMs: 0,
		});

		const result = runAction({
			action: {
				itemInstanceId: "item-instance:1",
				lineId: "line:test",
				inputRefs: [],
				type: "line.start",
			},
			config,
			nowMs: 500,
			save,
		});

		const job = readOnlyRecordValue(result.save.producerJobs);
		expect(job).toMatchObject({
			readyAtMs: 1500,
			itemInstanceId: "item-instance:1",
			lineId: "line:test",
			startAtMs: 500,
		});
		expect(result.events).toEqual([
			{
				atMs: 500,
				readyAtMs: 1500,
				jobId: job.id,
				itemInstanceId: "item-instance:1",
				lineId: "line:test",
				startAtMs: 500,
				type: "line.started",
			},
		]);
		expect(result.nextWakeAtMs).toBe(1500);
	});

	it("rejects products whose only output is blocked before planning or consuming inputs", () => {
		const baseConfig = createEngineTestConfig();
		const config = createEngineTestConfig({
			itemEffects: {
				"item:axe": [
					{
						id: "effect:test:block",
						grants: [
							{
								id: "grant:test:block",
								name: "Block grant",
							},
						],
						name: "Block Grant",
						polarity: "debuff",
						sourceScope: "inventory",
					},
				],
			},
			lineOverrides: {
				"line:shred": appendFirstOutputEffects(baseConfig.lineCatalog["line:shred"], [
					{
						display: "always",
						kind: "grant.blockStart",
						label: "Blocked by Axe",
						selector: {
							allOf: [
								{
									ids: [
										"grant:test:block",
									],
								},
							],
						},
					},
				]),
			},
			startingState: {
				...baseConfig.startingState,
				inventory: [
					{
						itemId: "item:axe",
						quantity: 1,
					},
				],
			},
		});
		const save = runInitialSave({
			config,
			nowMs: 0,
		});

		const result = runActionEither({
			action: {
				inputRefs: [],
				itemInstanceId: "item-instance:1",
				lineId: "line:shred",
				type: "line.start",
			},
			config,
			nowMs: 500,
			save,
		});

		expect(result).toMatchObject({
			_tag: "Left",
			left: {
				_tag: "GameActionRejected",
				reason: "effect:disabled-output",
			},
		});
	});

	it("rejects products whose visible output drops are all disabled by drop-owned effects", () => {
		const baseConfig = createEngineTestConfig();
		const config = createEngineTestConfig({
			itemEffects: {
				"item:empty-stash": [
					{
						id: "effect:test:unlock",
						polarity: "neutral",
						grants: [
							{
								id: "grant:test:unlock",
								name: "Unlock grant",
							},
						],
						name: "Unlock Grant",
					},
				],
			},
			lineOverrides: {
				"line:test": {
					...baseConfig.lineCatalog["line:test"],
					output: [
						{
							entries: [
								{
									itemId: "item:twig",
									quantity: 1,
									type: "guaranteed",
									effects: [
										{
											display: "always",
											kind: "grant.require",
											label: "Unlock Twig Drop",
											phase: "start",
											selector: {
												allOf: [
													{
														ids: [
															"grant:test:unlock",
														],
													},
												],
											},
										},
									],
								},
							],
						},
					],
				},
			},
		});
		const save = runInitialSave({
			config,
			nowMs: 0,
		});

		const result = runActionEither({
			action: {
				inputRefs: [],
				itemInstanceId: "item-instance:1",
				lineId: "line:test",
				type: "line.start",
			},
			config,
			nowMs: 500,
			save,
		});

		expect(result).toMatchObject({
			_tag: "Left",
			left: {
				_tag: "GameActionRejected",
				reason: "effect:disabled-output",
			},
		});
	});

	it("completes zero-duration lines in the same action", () => {
		const baseConfig = createEngineTestConfig();
		const config = createEngineTestConfig({
			lineOverrides: {
				"line:test": {
					...baseConfig.lineCatalog["line:test"],
					durationMs: 0,
					output: [
						{
							entries: [
								{
									itemId: "item:twig",
									quantity: 1,
									type: "guaranteed",
								},
							],
						},
					],
				},
			},
		});
		const save = runInitialSave({
			config,
			nowMs: 0,
		});

		const result = runAction({
			action: {
				inputRefs: [],
				itemInstanceId: "item-instance:1",
				lineId: "line:test",
				type: "line.start",
			},
			config,
			nowMs: 500,
			save,
		});

		expect(result.save.producerJobs).toEqual({});
		expect(result.nextWakeAtMs).toBeNull();
		expect(
			findBoardItem(result.save, {
				itemId: "item:twig",
				x: 1,
				y: 0,
			}),
		).toBeDefined();
		expect(result.events).toEqual([
			expect.objectContaining({
				atMs: 500,
				readyAtMs: 500,
				lineId: "line:test",
				type: "line.started",
			}),
			expect.objectContaining({
				atMs: 500,
				lineId: "line:test",
				type: "line.completed",
			}),
			expect.objectContaining({
				itemId: "item:twig",
				type: "item.created",
			}),
		]);
	});
});
