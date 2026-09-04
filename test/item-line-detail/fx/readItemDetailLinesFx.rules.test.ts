import { describe } from "vitest";
import {
	GameConfigSchema,
	expect,
	it,
	lineRunRuntime,
	lineRunTestConfig,
	readLines,
} from "../support/readItemDetailLinesFxFixture";
import type { RuntimeSchema } from "../support/readItemDetailLinesFxFixture";

describe("readItemDetailLinesFx / rule projection", () => {
	it("keeps unhinted rule conditions private", () => {
		const job = {
			id: "job:workshop",
			ownerItemId: "runtime:workshop",
			lineId: "line:workshop:build",
			durationMs: 1_000,
			remainingMs: 400,
		} as const;
		const missingPermit = readLines({
			...lineRunRuntime({
				permit: false,
			}),
			jobs: [
				job,
			],
		});
		const enabled = readLines({
			...lineRunRuntime({
				permit: true,
			}),
			jobs: [
				job,
			],
		});
		if (missingPermit.kind !== "available" || enabled.kind !== "available") {
			throw new Error("Expected live line projections.");
		}

		expect(missingPermit.line[0]?.availability).toEqual({
			kind: "unavailable",
			reason: {
				kind: "line-disabled",
				hint: undefined,
			},
		});
		expect(enabled.line[0]?.availability).toMatchObject({
			kind: "available",
		});
	});
	it("keeps active hints and lets the first disable veto own disclosure even without a hint", () => {
		const workshop = lineRunTestConfig.items.workshop;
		if (workshop.type !== "producer") throw new Error("Expected producer workshop.");
		const readHintedLines = (runtime: RuntimeSchema.Type, disableHint: string | undefined) => {
			const hintedConfig = GameConfigSchema.parse({
				...lineRunTestConfig,
				items: {
					...lineRunTestConfig.items,
					workshop: {
						...workshop,
						lines: workshop.lines.map((line) => ({
							...line,
							rules: line.rules.map((rule) => ({
								...rule,
								hint:
									rule.type === "enable"
										? "A permit is required."
										: rule.type === "disable"
											? disableHint
											: rule.type === "runtime:multiplier"
												? "A booster speeds up production."
												: undefined,
							})),
						})),
					},
				},
			});
			return readLines(
				{
					...runtime,
					items: runtime.items.map((item) =>
						item.id === "runtime:workshop"
							? {
									...item,
									item: hintedConfig.items.workshop,
								}
							: item,
					),
				},
				"runtime:workshop",
				hintedConfig,
			);
		};

		const active = readHintedLines(
			lineRunRuntime({
				permit: true,
				booster: true,
			}),
			undefined,
		);
		if (active.kind !== "available") throw new Error("Expected active line hints.");
		expect(active.line[0]?.activeRuleHints).toEqual([
			"A permit is required.",
			"A booster speeds up production.",
		]);

		const pendingRuntime = {
			...lineRunRuntime({}),
			jobs: [
				{
					id: "job:workshop",
					ownerItemId: "runtime:workshop",
					lineId: "line:workshop:build",
					durationMs: 1_000,
					remainingMs: 400,
				},
			],
		};
		const disabled = readHintedLines(pendingRuntime, undefined);
		if (disabled.kind !== "available") throw new Error("Expected disabled line detail.");
		expect(disabled.line[0]?.availability).toMatchObject({
			kind: "unavailable",
			reason: {
				kind: "line-disabled",
				hint: "A permit is required.",
			},
		});
		for (const hint of [
			undefined,
			"A blocker prevents this line.",
		]) {
			const vetoed = readHintedLines(
				{
					...lineRunRuntime({
						blocker: true,
					}),
					jobs: pendingRuntime.jobs,
				},
				hint,
			);
			if (vetoed.kind !== "available") throw new Error("Expected disabled line detail.");
			expect(vetoed.line[0]?.availability).toEqual({
				kind: "unavailable",
				reason: {
					kind: "line-disabled",
					hint,
				},
			});
		}
	});
});
