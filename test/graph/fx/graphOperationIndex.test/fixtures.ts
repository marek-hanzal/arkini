import { LineSchema } from "~/production-line/schema/LineSchema";
import { ItemScheduleSchema } from "~/item-schedule/schema/ItemScheduleSchema";
import { projectFn } from "../createProjectGraphFx.test/fixtures";
import { lineFn, outputFn, queryFn } from "../../fn/compileGraphFactsFn.test/fixtures";

export const searchProjectFn = () => {
	const project = projectFn([
		[
			"A",
			"B",
		],
	]);
	project.config.items.A.title = "Beagle Puppy";
	project.config.items.B.title = "Bio-Waste";
	project.config.items.A.lines = [
		LineSchema.parse(
			lineFn("a", {
				title: "Digest Food",
				trigger: "clock-interval",
				weight: 15,
				show: false,
				runtimeMs: 1000,
			}),
		),
		LineSchema.parse(
			lineFn("b", {
				title: "Digest",
				trigger: "clock-interval",
				weight: 16,
				show: false,
				runtimeMs: 2000,
				outcome: outputFn("B"),
			}),
		),
		LineSchema.parse(
			lineFn("c", {
				title: "Plague Exposure",
				enable: false,
				runtimeMs: 3000,
				input: [
					{
						type: "materials",
						query: queryFn("B"),
						mode: "reserve",
						quantity: {
							min: 1,
							max: 2,
						},
					},
				],
			}),
		),
	];
	project.config.items.A.clock = ItemScheduleSchema.parse({
		intervalMs: 1000,
		durationMs: 5000,
		enable: false,
	});
	project.config.items.A.merge![0].action = "spend";
	return project;
};
