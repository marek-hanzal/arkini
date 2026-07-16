import { describe, expect, it } from "vitest";
import {
	createEngineTestConfig,
	readOnlyRecordValue,
	readOwnedTwigGrantConfig,
	runAction,
	runActionEither,
	runInitialSave,
} from "./applyGameActionProducerFx.testSupport";

describe("applyGameActionFx Producer selection", () => {
	it("rechecks line grants after auto-filled inputs are consumed", () => {
		const baseConfig = createEngineTestConfig();
		const grantConfig = readOwnedTwigGrantConfig(baseConfig, [
			"line:shred",
		]);
		const config = createEngineTestConfig({
			...grantConfig,
			lineOverrides: {
				"line:shred": {
					...grantConfig.lineOverrides["line:shred"],
				},
			},
			startingState: {
				board: [
					{
						itemId: "item:producer",
						x: 0,
						y: 0,
					},
					{
						itemId: "item:twig",
						x: 1,
						y: 0,
					},
				],
				inventory: [],
			},
		});
		const save = runInitialSave({
			config,
			nowMs: 0,
		});

		const result = runActionEither({
			action: {
				itemInstanceId: "item-instance:1",
				lineId: "line:shred",
				inputRefs: [],
				type: "line.start",
			},
			config,
			nowMs: 0,
			save,
		});

		expect(result._tag).toBe("Left");
		if (result._tag === "Left") {
			expect(result.left).toMatchObject({
				_tag: "GameActionRejected",
				reason: "effect:disabled-output",
			});
		}
		expect(save.board.items["item-instance:2"]).toMatchObject({
			itemId: "item:twig",
		});
	});

	it("rejects default line action when no default line is selected", () => {
		const config = createEngineTestConfig();
		const save = runInitialSave({
			config,
			nowMs: 0,
		});

		const result = runActionEither({
			action: {
				itemInstanceId: "item-instance:1",
				inputRefs: [],
				type: "line.start",
			},
			config,
			nowMs: 500,
			save,
		});

		expect(result._tag).toBe("Left");
		if (result._tag === "Left") {
			expect(result.left).toMatchObject({
				_tag: "GameActionRejected",
				reason: "invalid_actor",
			});
		}
	});

	it("rejects hidden lines", () => {
		const baseConfig = createEngineTestConfig();
		const config = createEngineTestConfig({
			lineOverrides: {
				"line:shred": {
					...baseConfig.lineCatalog["line:shred"],
					visibility: "hidden",
				},
			},
		});
		const save = runInitialSave({
			config,
			nowMs: 0,
		});

		const result = runActionEither({
			action: {
				itemInstanceId: "item-instance:1",
				lineId: "line:shred",
				inputRefs: [],
				type: "line.start",
			},
			config,
			nowMs: 500,
			save,
		});

		expect(result._tag).toBe("Left");
		if (result._tag === "Left") {
			expect(result.left).toMatchObject({
				_tag: "GameActionRejected",
				reason: "invalid_actor",
			});
		}
	});

	it("starts the saved default line when lineId is omitted", () => {
		const config = createEngineTestConfig();
		const save = runInitialSave({
			config,
			nowMs: 0,
		});
		save.lines["item-instance:1"] = {
			defaultLineId: "line:shred",
		};

		const result = runAction({
			action: {
				itemInstanceId: "item-instance:1",
				inputRefs: [
					{
						itemInstanceId: "item-instance:2",
						kind: "board",
					},
				],
				type: "line.start",
			},
			config,
			nowMs: 500,
			save: {
				...save,
				board: {
					items: {
						...save.board.items,
						"item-instance:2": {
							id: "item-instance:2",
							itemId: "item:twig",
							x: 1,
							y: 0,
						},
					},
				},
			},
		});

		const job = readOnlyRecordValue(result.save.producerJobs);
		expect(job).toMatchObject({
			itemInstanceId: "item-instance:1",
			lineId: "line:shred",
		});
		expect(result.events).toContainEqual(
			expect.objectContaining({
				lineId: "line:shred",
				type: "line.started",
			}),
		);
	});
});
