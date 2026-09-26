import {
	configFn,
	expiryLineFn,
	itemFn,
	lineFn,
	outputFn,
	queryFn,
} from "../../fn/compileGraphFactsFn.test/fixtures";
import { projectFn } from "../createProjectGraphFx.test/fixtures";

export const auditProjectFn = () => ({
	...projectFn([]),
	config: configFn(
		{
			root: itemFn("root", {
				lines: [
					lineFn("grow", {
						outcome: outputFn("middle"),
						rules: [
							{
								type: "disable",
								when: [
									{
										type: "exists",
										query: queryFn("reference"),
									},
								],
							},
						],
					}),
				],
			}),
			middle: itemFn("middle", {
				lines: [
					lineFn("finish", {
						outcome: outputFn("finished"),
					}),
				],
			}),
			finished: itemFn("finished"),
			factory: itemFn("factory", {
				lines: [
					lineFn("build", {
						input: [
							{
								type: "materials",
								mode: "consume",
								query: queryFn("material"),
								quantity: {
									min: 1,
									max: 1,
								},
							},
						],
						outcome: outputFn("product"),
					}),
				],
			}),
			material: itemFn("material"),
			product: itemFn("product"),
			reference: itemFn("reference"),
			forgotten: itemFn("forgotten"),
			forgottenOther: itemFn("forgottenOther"),
			templateOnly: itemFn("templateOnly"),
			cycleA: itemFn("cycleA", {
				lines: [
					lineFn("cycle-a", {
						outcome: outputFn("cycleB"),
					}),
				],
			}),
			cycleB: itemFn("cycleB", {
				lines: [
					lineFn("cycle-b", {
						outcome: outputFn("cycleA"),
					}),
				],
			}),
		},
		{
			templates: [
				{
					uid: "T",
					title: "Initial",
					width: 4,
					height: 2,
					board: [
						{
							itemUid: "root",
							x: 0,
							y: 0,
						},
						{
							itemUid: "factory",
							x: 1,
							y: 0,
						},
					],
				},
				{
					uid: "Unused",
					title: "Unused",
					width: 4,
					height: 2,
					board: [
						{
							itemUid: "templateOnly",
							x: 0,
							y: 0,
						},
					],
				},
			],
		},
	),
});

export const factualAuditProjectFn = () => ({
	...projectFn([]),
	config: configFn(
		{
			emptyClock: itemFn("emptyClock", {
				clock: {
					intervalMs: 100,
				},
			}),
			emptyUnits: itemFn("emptyUnits", {
				units: {
					amount: 1,
				},
			}),
			emptyLine: itemFn("emptyLine", {
				lines: [
					lineFn("empty"),
				],
			}),
			activeClock: itemFn("activeClock", {
				lines: [
					expiryLineFn("activeClock-expiry", outputFn("product")),
				],
				clock: {
					durationMs: 100,
				},
			}),
			product: itemFn("product"),
			battery: itemFn("battery", {
				units: {
					amount: 3,
				},
			}),
			factory: itemFn("factory", {
				lines: Array.from(
					{
						length: 4,
					},
					(_, index) => {
						const outcome = outputFn("battery");
						return lineFn(`build-${index}`, {
							enable: false,
							input: [
								{
									type: "materials",
									query: queryFn("missing"),
									quantity: {
										min: 1,
										max: 1,
									},
								},
							],
							outcome: {
								set: [
									{
										...outcome.set[0],
										weight: 1,
										roll: [
											{
												...outcome.set[0].roll[0],
												type: "chance",
												chance: 0,
												outcome: [
													...outcome.set[0].roll[0].outcome,
													...outcome.set[0].roll[0].outcome,
												],
											},
										],
									},
								],
							},
							rules: [
								{
									type: "disable",
									when: [
										{
											type: "exists",
											query: queryFn("reference"),
										},
									],
								},
							],
						});
					},
				),
			}),
			reference: itemFn("reference", {
				units: {
					amount: 1,
				},
				clock: {
					intervalMs: 100,
				},
			}),
			templateOnly: itemFn("templateOnly"),
			payer: itemFn("payer", {
				units: {
					amount: 3,
				},
				lines: [
					lineFn("pay", {
						input: [
							{
								type: "units" as const,
								query: {
									distance: "self" as const,
									selector: {
										type: "item" as const,
										itemUid: "payer",
									},
								},
								units: {
									from: "self",
									cost: 1,
								},
							},
						],
					}),
				],
			}),
			mergeSource: itemFn("mergeSource", {
				merge: [
					{
						target: {
							type: "item",
							itemUid: "mergeTarget",
						},
						action: "use",
						effect: "keep",
					},
				],
			}),
			mergeTarget: itemFn("mergeTarget"),
			receiver: itemFn("receiver", {
				merge: [
					{
						action: "space",
						space: 1,
						effect: "keep",
					},
				],
			}),
		},
		{
			templates: [
				{
					uid: "T",
					title: "T",
					width: 4,
					height: 2,
					board: [],
				},
				{
					uid: "Unused",
					title: "Unused",
					width: 4,
					height: 2,
					board: [
						{
							itemUid: "templateOnly",
							x: 0,
							y: 0,
						},
					],
				},
			],
		},
	),
});
