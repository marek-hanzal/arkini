import { GameConfigSchema } from "~/game-config/schema/GameConfigSchema";
import { createGraphProject, createToolProject } from "../support/createToolProject";
import { createRelationTraversalProject } from "./fixture";

export const createSummaryProject = () => {
	const base = createRelationTraversalProject();
	const query = {
		distance: "close",
		selector: {
			type: "item",
			itemUid: "water",
		},
	};
	const output = (itemUid: string) => ({
		set: [
			{
				rules: [],
				roll: [
					{
						type: "guaranteed",
						outcome: [
							{
								type: "item",
								itemUid,
								quantity: {
									min: 1,
									max: 2,
								},
								rules: [],
							},
						],
					},
				],
			},
		],
	});
	return createToolProject(
		GameConfigSchema.parse({
			...base.config,
			items: {
				...base.config.items,
				forge: {
					...base.config.items.forge,
					lines: base.config.items.forge.lines.map((line) => ({
						...line,
						input: [
							...line.input,
							{
								type: "units",
								query: {
									...query,
									selector: {
										type: "item",
										itemUid: "tool",
									},
								},
								units: {
									cost: 1,
									from: "target",
								},
							},
						],
						rules: [
							{
								type: "enable",
								when: [
									{
										type: "exists",
										query,
									},
								],
							},
						],
						outcome: {
							set: [
								{
									weight: 3,
									rules: [],
									roll: [
										{
											type: "chance",
											chance: 0.25,
											outcome: [
												{
													type: "item",
													itemUid: "ingot",
													quantity: {
														min: 1,
														max: 3,
													},
													rules: [
														{
															type: "disable",
															when: [
																{
																	type: "exists",
																	query,
																},
															],
														},
													],
												},
												{
													type: "item",
													itemUid: "dust",
													quantity: {
														min: 2,
														max: 2,
													},
													rules: [],
												},
											],
										},
									],
								},
								{
									weight: 1,
									rules: [],
									roll: [
										{
											type: "guaranteed",
											outcome: [
												{
													type: "item",
													itemUid: "plate",
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
					})),
				},
				mill: {
					...base.config.items.mill,
					lines: base.config.items.mill.lines.map((line) => ({
						...line,
						outcome: output("forge"),
					})),
				},
				tool: {
					...base.config.items.tool,
					units: {
						amount: 2,
						outcome: output("ingot"),
					},
					merge: [
						{
							action: "spend",
							target: {
								type: "item",
								itemUid: "water",
							},
							effect: "remove",
							outcome: output("ingot"),
						},
					],
				},
				water: {
					...base.config.items.water,
					lines: [
						{
							...base.config.items.forge.lines[0],
							id: "water-from-mill",
							title: "Water",
							input: [
								{
									type: "materials",
									query: {
										distance: "far",
										selector: {
											type: "item",
											itemUid: "mill",
										},
									},
									mode: "consume",
									quantity: {
										min: 1,
										max: 1,
									},
								},
							],
							outcome: output("mill"),
						},
					],
				},
			},
		}),
	);
};

export const createRequirementSummaryProject = () => {
	const base = createGraphProject();
	return createToolProject(
		GameConfigSchema.parse({
			...base.config,
			items: {
				...base.config.items,
				tool: {
					...base.config.items.tool,
					units: {
						amount: 10,
					},
				},
				forge: {
					...base.config.items.forge,
					lines: base.config.items.forge.lines.map((line) => ({
						...line,
						input: [
							...line.input,
							{
								type: "units",
								query: {
									distance: "close",
									selector: {
										type: "item",
										itemUid: "tool",
									},
								},
								units: {
									from: "target",
									cost: 1,
								},
							},
						],
					})),
				},
			},
		}),
	);
};

export const createConditionalSummaryProject = () => {
	const base = createSummaryProject();
	return createToolProject(
		GameConfigSchema.parse({
			...base.config,
			items: {
				...base.config.items,
				tool: {
					...base.config.items.tool,
					merge: [
						{
							...base.config.items.tool.merge![0],
							effect: "replace",
							result: "ingot",
						},
					],
				},
				water: {
					...base.config.items.water,
					ui: "simple",
					clock: {
						durationMs: 5000,
						intervalMs: 1000,
						enable: false,
						rules: [
							{
								type: "enable",
								when: [
									{
										type: "exists",
										query: {
											distance: "far",
											selector: {
												type: "item",
												itemUid: "tool",
											},
										},
									},
								],
							},
						],
						onExpire: base.config.items.forge.lines[0]!.outcome,
					},
				},
				forge: {
					...base.config.items.forge,
					lines: base.config.items.forge.lines.map((line) => ({
						...line,
						outcome: {
							...line.outcome,
							set: line.outcome!.set.map((set) => ({
								...set,
								rules: [
									{
										type: "enable",
										when: [
											{
												type: "exists",
												query: {
													distance: "far",
													selector: {
														type: "item",
														itemUid: "tool",
													},
												},
											},
										],
									},
								],
							})),
						},
					})),
				},
			},
		}),
	);
};

export const createSelfMergeSummaryProject = () => {
	const base = createSummaryProject();
	return createToolProject(
		GameConfigSchema.parse({
			...base.config,
			items: {
				...base.config.items,
				tool: {
					...base.config.items.tool,
					merge: [
						{
							...base.config.items.tool.merge![0],
							target: {
								type: "item",
								itemUid: "tool",
							},
							effect: "spend",
						},
					],
				},
			},
		}),
	);
};
