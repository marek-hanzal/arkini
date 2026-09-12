import { GameConfigSchema } from "~/game-config/schema/GameConfigSchema";
import type { RuntimeSchema } from "~/game-runtime/schema/RuntimeSchema";
import { createJobTestConfig } from "~test/production-job/support/jobTestConfig";
import { existsWhen } from "~test/production-line/support/lineTestRuntime";

export type Blocker =
	| "missing-input"
	| "rule"
	| "self-unit"
	| "aggregate-self-unit"
	| "target-unit"
	| "output-capacity"
	| "placement";

export const createBlockedQueueFixture = (blocker: Blocker) => {
	const base = createJobTestConfig(2, "any");
	const forge = base.items.forge;
	if (forge.type !== "common") throw new Error("Expected producer fixture.");
	const material = {
		type: "materials",
		selector: {
			type: "item",
			itemId: "water",
		},
		quantity: {
			min: 2,
			max: 2,
		},
		capacity: 2,
		mode: "consume",
		...(blocker === "self-unit" || blocker === "aggregate-self-unit" || blocker === "placement"
			? {
					units: {
						from: "self",
						cost:
							blocker === "self-unit" ? 4 : blocker === "aggregate-self-unit" ? 2 : 1,
					},
				}
			: {}),
	};
	const output = (itemId: string, quantity: number, placement = "drop") => ({
		set: [
			{
				roll: [
					{
						type: "guaranteed",
						drop: [
							{
								itemId,
								quantity: {
									min: quantity,
									max: quantity,
								},
								placement,
								rules: [],
							},
						],
					},
				],
			},
		],
	});
	const config = GameConfigSchema.parse({
		...base,
		meta: {
			...base.meta,
			board: {
				width: 3,
				height: 1,
			},
		},
		items: {
			...base.items,
			permit: {
				...base.items.tool,
				id: "permit",
				uid: "permit",
			},
			result: {
				...base.items.tool,
				id: "result",
				uid: "result",
				scope: "board",
				maxStackSize: 1,
				maxCount: 1,
			},
			debris: {
				...base.items.tool,
				id: "debris",
				uid: "debris",
				scope: "board",
				maxStackSize: 1,
			},
			payer: {
				...base.items.tool,
				id: "payer",
				uid: "payer",
				units: {
					amount: 1,
					output: output("debris", 2, "random"),
				},
			},
			forge: {
				...forge,
				units: {
					amount: 3,
				},
				lines: [
					{
						id: "blocked",
						title: "Blocked",
						description: "Blocked work",
						runtimeMs: 1_000,
						input: [
							material,
							...(blocker === "placement" || blocker === "aggregate-self-unit"
								? [
										{
											type: "materials",
											selector: {
												type: "item",
												itemId: "tool",
											},
											quantity: {
												min: 1,
												max: 1,
											},
											capacity: 1,
											mode: "reserve",
											...(blocker === "aggregate-self-unit"
												? {
														units: {
															from: "self",
															cost: 2,
														},
													}
												: {}),
										},
									]
								: []),
							...(blocker === "placement" || blocker === "target-unit"
								? [
										{
											type: "units",
											query: {
												scope: "board",
												selector: {
													type: "item",
													itemId: "payer",
												},
												distance: "close",
											},
											units: {
												from: "target",
												cost: 1,
											},
										},
									]
								: []),
						],
						rules:
							blocker === "rule"
								? [
										{
											type: "enable",
											when: [
												existsWhen("permit"),
											],
										},
									]
								: [],
						...(blocker === "output-capacity"
							? {
									output: output("result", 1),
								}
							: {}),
					},
					{
						id: "ready",
						title: "Ready",
						description: "Ready work",
						runtimeMs: 1_000,
						input: [
							{
								type: "simple",
							},
						],
						rules: [],
					},
				],
			},
		},
	});
	const board = (x: number) => ({
		scope: "board" as const,
		space: 0,
		position: {
			x,
			y: 0,
		},
	});
	const request = {
		id: "request:blocked",
		ownerItemId: "owner",
		lineId: "blocked",
	};
	const runtime: RuntimeSchema.Type = {
		cheats: {
			enabled: false,
			everEnabled: false,
			instantGameplay: false,
		},
		currentSpace: 0,
		defaultLineByOwnerItemId: {},
		jobs: [],
		jobQueue: [
			request,
			{
				...request,
				id: "request:ready",
				lineId: "ready",
			},
		],
		items: [
			{
				id: "owner",
				revision: "revision:owner",
				item: config.items.forge,
				quantity: 1,
				location: board(0),
			},
			{
				id: "result",
				revision: "revision:result",
				item: config.items.result,
				quantity: 1,
				location: board(2),
			},
			{
				id: "buffer",
				revision: "revision:buffer",
				item: config.items.water,
				quantity: blocker === "placement" ? 2 : 1,
				location: {
					scope: "input",
					ownerItemId: "owner",
					lineId: "blocked",
					inputIndex: 0,
				},
			},
		],
	};
	if (blocker === "placement" || blocker === "aggregate-self-unit") {
		runtime.items.push({
			id: "tool",
			revision: "revision:tool",
			item: config.items.tool,
			quantity: 1,
			location: {
				scope: "input",
				ownerItemId: "owner",
				lineId: "blocked",
				inputIndex: 1,
			},
		});
	}
	if (blocker === "placement") {
		runtime.items.push({
			id: "payer",
			revision: "revision:payer",
			item: config.items.payer,
			quantity: 1,
			location: board(1),
		});
	} else if (blocker !== "missing-input") {
		runtime.items.push({
			id: "supply",
			revision: "revision:supply",
			item: config.items.water,
			quantity: 1,
			location: {
				scope: "inventory",
				position: {
					x: 0,
					y: 0,
				},
			},
		});
	}
	return {
		config,
		runtime,
		request,
	};
};
