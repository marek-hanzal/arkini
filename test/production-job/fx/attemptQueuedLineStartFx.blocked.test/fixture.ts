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
	| "placement";

export const createBlockedQueueFixture = (blocker: Blocker) => {
	const base = createJobTestConfig(2);
	const forge = base.items.forge;
	const material = {
		type: "materials",
		query: {
			distance: "far" as const,
			selector: {
				type: "item",
				itemUid: "water",
			},
		},
		quantity: {
			min: 2,
			max: 2,
		},
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
	const outcome = (itemId: string, quantity: number, placement = "drop") => ({
		set: [
			{
				rules: [],
				roll: [
					{
						type: "guaranteed",
						outcome: [
							{
								type: "item" as const,
								itemUid: itemId,
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
				uid: "permit",
			},
			result: {
				...base.items.tool,
				uid: "result",
			},
			debris: {
				...base.items.tool,
				uid: "debris",
			},
			payer: {
				...base.items.tool,
				uid: "payer",
				units: {
					amount: 1,
					outcome: outcome("debris", 2, "random"),
				},
			},
			forge: {
				...forge,
				units: {
					amount: 3,
				},
				lines: [
					{
						uid: "blocked",
						title: "Blocked",
						description: "Blocked work",
						runtimeMs: 1_000,
						input: [
							material,
							...(blocker === "placement" || blocker === "aggregate-self-unit"
								? [
										{
											type: "materials",
											query: {
												distance: "far" as const,
												selector: {
													type: "item",
													itemUid: "tool",
												},
											},
											quantity: {
												min: 1,
												max: 1,
											},
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
												selector: {
													type: "item",
													itemUid: "payer",
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
					},
					{
						uid: "ready",
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
		lineUid: "blocked",
	};
	const runtime: RuntimeSchema.Type = {
		cheats: {
			enabled: false,
			everEnabled: false,
			speedUpGameplay: false,
		},
		currentSpace: 0,
		templateUidBySpace: {},
		defaultLineByOwnerItemId: {},
		jobs: [],
		jobQueue: [
			request,
			{
				...request,
				id: "request:ready",
				lineUid: "ready",
			},
		],
		items: [
			{
				id: "owner",
				revision: "revision:owner",
				item: config.items.forge,

				location: board(0),
			},
			{
				id: "result",
				revision: "revision:result",
				item: config.items.result,

				location: board(2),
			},
			{
				id: "buffer",
				revision: "revision:buffer",
				item: config.items.water,

				location: {
					scope: "input",
					ownerItemId: "owner",
					lineUid: "blocked",
					inputIndex: 0,
				},
			},
		],
	};
	if (blocker === "placement")
		runtime.items.push({
			...runtime.items[2]!,
			id: "buffer:second",
			revision: "revision:buffer:second",
		});
	if (blocker === "placement" || blocker === "aggregate-self-unit") {
		runtime.items.push({
			id: "tool",
			revision: "revision:tool",
			item: config.items.tool,

			location: {
				scope: "input",
				ownerItemId: "owner",
				lineUid: "blocked",
				inputIndex: 1,
			},
		});
	}
	if (blocker === "placement") {
		runtime.items.push({
			id: "payer",
			revision: "revision:payer",
			item: config.items.payer,

			location: board(1),
		});
	} else if (blocker !== "missing-input") {
		runtime.items.push({
			id: "supply",
			revision: "revision:supply",
			item: config.items.water,

			location: {
				scope: "board" as const,
				space: 0,
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
