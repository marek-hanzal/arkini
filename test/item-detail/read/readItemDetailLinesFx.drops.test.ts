import { describe } from "vitest";
import {
	Effect,
	GameConfigSchema,
	expect,
	it,
	lineRunRuntime,
	lineRunTestConfig,
	readLines,
	startFx,
	useGameFx,
} from "./readItemDetailLinesFx.test/fixture";

describe("readItemDetailLinesFx / drops and stale identities", () => {
	it("groups duplicate drops without flattening guaranteed and chance rolls", () => {
		const config = GameConfigSchema.parse({
			version: "1.0",
			resources: {
				hero: "hero",
			},
			meta: {
				id: "game:tile-lines-output",
				title: "Tile lines output",
				board: {
					width: 1,
					height: 1,
				},
				inventory: {
					width: 1,
					height: 1,
				},
			},
			start: {
				currentSpace: 0,
				board: [
					{
						itemId: "workshop",
						space: 0,
						x: 0,
						y: 0,
					},
				],
			},
			items: {
				workshop: {
					uid: "workshop",
					id: "workshop",
					type: "producer",
					title: "Workshop",
					description: "Produces grouped output.",
					asset: {
						default: [
							"asset:workshop",
						],
					},
					scope: "board",
					maxStackSize: 1,
					maxQueueSize: 1,
					lines: [
						{
							id: "line:workshop:output",
							title: "Output",
							description: "Produces output.",
							show: true,
							enable: true,
							runtimeMs: 1_000,
							input: [
								{
									type: "simple",
								},
							],
							rules: [],
							output: {
								set: [
									{
										roll: [
											{
												type: "guaranteed",
												drop: [
													{
														itemId: "wood",
														quantity: {
															min: 2,
															max: 2,
														},
														rules: [
															{
																type: "enable",
																hint: "The workshop provides seasoned timber.",
																when: [
																	{
																		type: "exists",
																		query: {
																			scope: "any",
																			selector: {
																				type: "item",
																				itemId: "workshop",
																			},
																		},
																	},
																],
															},
														],
													},
													{
														itemId: "wood",
														quantity: {
															min: 1,
															max: 3,
														},
														rules: [],
													},
												],
											},
											{
												type: "chance",
												chance: 0.25,
												drop: [
													{
														itemId: "gem",
														quantity: {
															min: 1,
															max: 1,
														},
														rules: [],
													},
												],
											},
										],
									},
								],
							},
						},
					],
				},
				wood: {
					uid: "wood",
					id: "wood",
					type: "simple",
					title: "Wood",
					description: "Wood.",
					asset: {
						default: [
							"asset:wood",
						],
					},
					scope: "any",
					maxStackSize: 10,
				},
				gem: {
					uid: "gem",
					id: "gem",
					type: "simple",
					title: "Gem",
					description: "Gem.",
					asset: {
						default: [
							"asset:gem",
						],
					},
					scope: "any",
					maxStackSize: 10,
				},
			},
		});
		const runtime = Effect.runSync(
			startFx().pipe(
				useGameFx({
					config,
				}),
			),
		);
		const ownerId = runtime.items[0]?.id;
		if (ownerId === undefined) throw new Error("Missing output owner.");
		const lines = readLines(runtime, ownerId, config);
		expect(lines.kind).toBe("available");
		if (lines.kind !== "available") throw new Error("Expected available lines.");
		expect(lines.line[0]?.output).toEqual([
			{
				weight: 1,
				roll: [
					{
						kind: "guaranteed",
						item: [
							{
								itemId: "wood",
								quantity: {
									min: 3,
									max: 5,
								},
								activeRuleHints: [
									"The workshop provides seasoned timber.",
								],
							},
						],
					},
					{
						kind: "chance",
						chance: 0.25,
						item: [
							{
								itemId: "gem",
								quantity: {
									min: 1,
									max: 1,
								},
								activeRuleHints: [],
							},
						],
					},
				],
			},
		]);
	});
	it("returns unavailable for stale and non-line identities", () => {
		const runtime = lineRunRuntime({});
		expect(readLines(runtime, "runtime:missing")).toEqual({
			kind: "unavailable",
		});
		const water = runtime.items.find(
			(item) => item.item.id === lineRunTestConfig.items.water.id,
		);
		if (water !== undefined) {
			expect(readLines(runtime, water.id)).toEqual({
				kind: "unavailable",
			});
		}
	});
});
