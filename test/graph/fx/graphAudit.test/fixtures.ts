import {
	configFn,
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
