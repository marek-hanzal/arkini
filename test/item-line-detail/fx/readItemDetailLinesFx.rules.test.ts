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
	it("keeps unhinted rule causes private and gives disable veto deterministic priority", () => {
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
		const disableVeto = readLines({
			...lineRunRuntime({
				blocker: true,
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
		if (
			missingPermit.kind !== "available" ||
			disableVeto.kind !== "available" ||
			enabled.kind !== "available"
		) {
			throw new Error("Expected live line projections.");
		}

		expect(missingPermit.line[0]?.availability).toEqual({
			kind: "unavailable",
			reason: {
				kind: "line-disabled",
				cause: {
					kind: "static",
				},
			},
		});
		expect(disableVeto.line[0]?.availability).toEqual({
			kind: "unavailable",
			reason: {
				kind: "line-disabled",
				cause: {
					kind: "static",
				},
			},
		});
		expect(enabled.line[0]?.availability).toMatchObject({
			kind: "available",
		});
	});
	it("projects only active authored rule hints and uses hints for disabled causes", () => {
		const workshop = lineRunTestConfig.items.workshop;
		if (workshop.type !== "producer") throw new Error("Expected producer workshop.");
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
										? "A blocker prevents this line."
										: rule.type === "runtime:multiplier"
											? "A booster speeds up production."
											: undefined,
						})),
					})),
				},
			},
		});
		const hintedRuntime = (runtime: RuntimeSchema.Type) =>
			({
				...runtime,
				items: runtime.items.map((item) =>
					item.id === "runtime:workshop"
						? {
								...item,
								item: hintedConfig.items.workshop,
							}
						: item,
				),
			}) satisfies RuntimeSchema.Type;

		const active = readLines(
			hintedRuntime(
				lineRunRuntime({
					permit: true,
					booster: true,
				}),
			),
			"runtime:workshop",
			hintedConfig,
		);
		if (active.kind !== "available") throw new Error("Expected active line hints.");
		expect(active.line[0]?.activeRuleHints).toEqual([
			"A permit is required.",
			"A booster speeds up production.",
		]);

		const disabled = readLines(
			hintedRuntime({
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
			}),
			"runtime:workshop",
			hintedConfig,
		);
		if (disabled.kind !== "available") throw new Error("Expected disabled line detail.");
		expect(disabled.line[0]?.availability).toMatchObject({
			kind: "unavailable",
			reason: {
				kind: "line-disabled",
				cause: {
					kind: "enable-rule",
					hint: "A permit is required.",
				},
			},
		});
	});
});
