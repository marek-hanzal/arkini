import { GameConfigSchema } from "~/game-config/schema/GameConfigSchema";

export const queryFn = (itemUid: string, distance = "far") => ({
	selector: {
		type: "item",
		itemUid,
	},
	distance,
});
export const itemFn = (uid: string, fields: Record<string, unknown> = {}) => ({
	uid,
	title: uid,
	artwork: {
		scale: 0.8,
		default: [
			"art",
		],
	},
	...fields,
});
export const lineFn = (uid: string, fields: Record<string, unknown> = {}) => ({
	uid,
	title: uid,
	description: uid,
	runtimeMs: 0,
	input: [
		{
			type: "simple",
		},
	],
	rules: [],
	...fields,
});
export const expiryLineFn = (uid: string, outcome: ReturnType<typeof outputFn>) =>
	lineFn(uid, {
		trigger: "item-termination",
		runtimeMs: 0,
		input: [],
		outcome,
	});
export const outputFn = (itemUid: string) => ({
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
								max: 1,
							},
							rules: [],
						},
					],
				},
			],
		},
	],
});
export const configFn = (items: Record<string, unknown>, extra: Record<string, unknown> = {}) =>
	GameConfigSchema.parse({
		resources: {
			hero: "hero",
		},
		meta: {
			id: "graph-test",
			title: "Graph test",
			board: {
				width: 4,
				height: 2,
			},
		},
		templates: [
			{
				uid: "T",
				title: "T",
				width: 4,
				height: 2,
				board: [],
			},
		],
		start: {
			currentSpace: 0,
			spaces: [
				{
					space: 0,
					templateUid: "T",
				},
			],
		},
		items,
		...extra,
	});

/** One compiler-valid world combining independent relation roles on the same item pair. */
export const adversarialConfigFn = () => {
	const exists = {
		type: "exists",
		query: queryFn("B"),
	};
	const absent = {
		type: "count",
		count: 0,
		query: queryFn("B", "self"),
	};
	const range = {
		type: "range",
		min: 0,
		max: 3,
		query: queryFn("B", "near-close"),
	};
	const enable = [
		{
			type: "enable",
			when: [
				absent,
				exists,
			],
		},
	];
	const mixedOutcome = {
		set: [
			{
				weight: 7,
				rules: enable,
				roll: [
					{
						type: "chance",
						chance: 0,
						outcome: [
							{
								type: "item",
								itemUid: "B",
								quantity: {
									min: 2,
									max: 4,
								},
								placement: "random",
								rules: enable,
							},
							{
								type: "space",
								space: 7,
								rules: [
									{
										type: "disable",
										when: [
											range,
										],
									},
								],
							},
							{
								type: "template",
								templateUid: "T",
								rules: enable,
							},
							{
								type: "item",
								itemUid: "B",
								quantity: {
									min: 1,
									max: 1,
								},
								rules: [],
							},
						],
					},
					{
						type: "guaranteed",
						outcome: [
							{
								type: "item",
								itemUid: "B",
								quantity: {
									min: 3,
									max: 3,
								},
								rules: [],
							},
						],
					},
				],
			},
			{
				weight: 2,
				rules: [],
				roll: [
					{
						type: "guaranteed",
						outcome: [
							{
								type: "item",
								itemUid: "B",
								quantity: {
									min: 5,
									max: 8,
								},
								rules: [],
							},
						],
					},
				],
			},
		],
	};
	return configFn(
		{
			A: itemFn("A", {
				units: {
					amount: 20,
				},
				terminationMode: "kill-switch",
				clock: {
					intervalMs: 100,
					durationMs: 500,
					rules: enable,
				},
				lines: [
					lineFn("A-L", {
						trigger: "clock-interval",
						weight: 999,
						default: false,
						show: false,
						enable: false,
						input: [
							{
								type: "materials",
								query: queryFn("B"),
								mode: "consume",
								quantity: {
									min: 1,
									max: 3,
								},
								units: {
									from: "self",
									cost: 2,
								},
							},
							{
								type: "materials",
								query: queryFn("B", "close"),
								mode: "reserve",
								quantity: {
									min: 1,
									max: 1,
								},
							},
							{
								type: "units",
								query: queryFn("B", "near"),
								units: {
									from: "target",
									cost: 3,
								},
							},
							{
								type: "simple",
								units: {
									from: "self",
									cost: 1,
								},
							},
							{
								type: "units",
								query: queryFn("A", "self"),
								units: {
									from: "target",
									cost: 1,
								},
							},
							{
								type: "units",
								query: queryFn("B", "close"),
								units: {
									from: "self",
									cost: 1,
								},
							},
						],
						rules: [
							{
								type: "enable",
								when: [
									absent,
								],
							},
							{
								type: "disable",
								when: [
									absent,
									exists,
								],
							},
							{
								type: "show",
								when: [
									exists,
								],
							},
							{
								type: "hide",
								when: [
									range,
								],
							},
							{
								type: "runtime:multiplier",
								multiplier: 0.5,
								when: [
									exists,
								],
							},
							{
								type: "runtime:adjust",
								adjustMs: -42,
								when: [
									absent,
								],
							},
						],
						outcome: mixedOutcome,
					}),
					expiryLineFn("A-expiry", outputFn("B")),
				],
				merge: [
					{
						target: {
							type: "item",
							itemUid: "B",
						},
						action: "spend",
						effect: "spend",
						outcome: outputFn("B"),
					},
					{
						target: {
							type: "item",
							itemUid: "B",
						},
						action: "consume",
						effect: "replace",
						result: "D",
					},
					{
						action: "space",
						space: 7,
						effect: "replace",
						result: "D",
						outcome: outputFn("B"),
					},
				],
			}),
			B: itemFn("B", {
				units: {
					amount: 20,
				},
				lines: [
					lineFn("B-L", {
						input: [
							{
								type: "materials",
								query: queryFn("C"),
								quantity: {
									min: 1,
									max: 1,
								},
							},
						],
					}),
				],
			}),
			C: itemFn("C", {
				lines: [
					lineFn("C-L", {
						input: [
							{
								type: "materials",
								query: queryFn("A"),
								quantity: {
									min: 1,
									max: 1,
								},
							},
						],
					}),
				],
			}),
			D: itemFn("D"),
		},
		{
			templates: [
				{
					uid: "T",
					title: "T",
					width: 4,
					height: 2,
					board: [
						{
							itemUid: "A",
							x: 0,
							y: 0,
						},
						{
							itemUid: "B",
							x: 1,
							y: 0,
						},
						{
							itemUid: "B",
							x: 2,
							y: 0,
						},
					],
				},
			],
			start: {
				currentSpace: 0,
				spaces: [
					{
						space: 0,
						templateUid: "T",
					},
					{
						space: 7,
						templateUid: "T",
					},
				],
			},
		},
	);
};
