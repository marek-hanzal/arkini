import { itemFn, lineFn, outputFn } from "../../fn/compileGraphFactsFn.test/fixtures";

const mergeFn = (target: string, result: string, extra = {}) => ({
	action: "consume",
	effect: "replace",
	target: {
		type: "item",
		itemUid: target,
	},
	result,
	...extra,
});

export const medicinalItemsFn = (restore: "none" | "same-roll" | "other-set" | "other-chance") => {
	const recycle = outputFn("jar");
	const sick = outputFn("sick");
	if (restore === "same-roll")
		recycle.set[0].roll[0].outcome.push(sick.set[0].roll[0].outcome[0]);
	if (restore === "other-set") recycle.set.push(sick.set[0]);
	const outcome =
		restore === "other-chance"
			? {
					set: [
						{
							rules: [],
							roll: [
								...recycle.set[0].roll,
								{
									...sick.set[0].roll[0],
									type: "chance",
									chance: 0.5,
								},
							],
						},
					],
				}
			: recycle;
	return {
		medicine: itemFn("medicine", {
			merge: [
				mergeFn("sick", "recovering", {
					outcome: outputFn("dirty"),
				}),
			],
		}),
		sick: itemFn("sick"),
		recovering: itemFn("recovering", {
			clock: {
				durationMs: 1000,
				onExpire: outputFn("healthy"),
			},
		}),
		healthy: itemFn("healthy"),
		dirty: itemFn("dirty", {
			lines: [
				lineFn("wash", {
					outcome,
				}),
			],
		}),
		jar: itemFn("jar", {
			merge: [
				mergeFn("sick", "goal"),
			],
		}),
		goal: itemFn("goal"),
	};
};
