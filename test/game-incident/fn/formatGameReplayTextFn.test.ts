import { describe, expect, it } from "vitest";

import { formatGameReplayTextFn } from "~/game-incident/fn/formatGameReplayTextFn";
import type { GameDiagnosticRuntime } from "~/game-incident/type/GameDiagnosticRuntime";
import type { GameReplayReport } from "~/game-incident/type/GameReplayReport";

const itemReference = {
	runtimeItemId: "runtime:item:forge",
	definition: {
		itemId: "forge",
		itemUid: "uid:forge",
		title: "Forge",
	},
} satisfies GameDiagnosticRuntime["items"][number]["item"];

const runtime = ({
	cheats = {
		enabled: false,
		everEnabled: false,
		instantGameplay: false,
	},
	currentSpace,
	defaultLineId,
	quantity = 1,
}: {
	readonly cheats?: GameDiagnosticRuntime["cheats"];
	readonly currentSpace: number;
	readonly defaultLineId?: string;
	readonly quantity?: number;
}): GameDiagnosticRuntime => ({
	currentSpace,
	cheats,
	items: [
		{
			item: itemReference,
			quantity,
			location: {
				scope: "board",
				space: 0,
			},
		},
	],
	jobs: [],
	queue: [],
	defaultLines:
		defaultLineId === undefined
			? []
			: [
					{
						owner: itemReference,
						lineId: defaultLineId,
					},
				],
});

const report = ({
	initialRuntime,
	finalRuntime,
}: {
	readonly initialRuntime: GameDiagnosticRuntime;
	readonly finalRuntime: GameDiagnosticRuntime;
}): GameReplayReport => ({
	applicationVersion: "0.6.0",
	packageId: "game:test",
	contentHash: "hash:test",
	gameVersion: "1.0",
	elapsedMs: 100,
	result: "timeout",
	initialSequence: 0,
	finalSequence: 1,
	observedSnapshots: 1,
	semanticTransitions: 1,
	history: {
		retainedLimit: 32,
		totalEntries: 0,
		entries: [],
	},
	failure: null,
	initialRuntime,
	finalRuntime,
});

describe("formatGameReplayTextFn", () => {
	it("recognizes a current-space-only change without adding an empty failure section", () => {
		const text = formatGameReplayTextFn(
			report({
				initialRuntime: runtime({
					currentSpace: 0,
				}),
				finalRuntime: runtime({
					currentSpace: 1,
				}),
			}),
		);

		expect(text).toContain("- Current space: 0 → 1");
		expect(text).not.toContain("No runtime change was observed");
		expect(text).not.toContain("# Failure");
	});

	it("reports meaningful item changes", () => {
		const text = formatGameReplayTextFn(
			report({
				initialRuntime: runtime({
					currentSpace: 0,
				}),
				finalRuntime: runtime({
					currentSpace: 0,
					quantity: 2,
				}),
			}),
		);

		expect(text).toContain("quantity 1 → 2");
	});

	it("reports cheat changes instead of claiming that the runtime stayed unchanged", () => {
		const text = formatGameReplayTextFn(
			report({
				initialRuntime: runtime({
					currentSpace: 0,
				}),
				finalRuntime: runtime({
					cheats: {
						enabled: true,
						everEnabled: true,
						instantGameplay: true,
					},
					currentSpace: 0,
				}),
			}),
		);

		expect(text).toContain("### Cheats");
		expect(text).toContain("- Enabled: no → yes");
		expect(text).toContain("- Ever enabled: no → yes");
		expect(text).toContain("- Instant gameplay: no → yes");
		expect(text).not.toContain("No runtime change was observed");
	});

	it("reports default-line changes instead of claiming that the runtime stayed unchanged", () => {
		const text = formatGameReplayTextFn(
			report({
				initialRuntime: runtime({
					currentSpace: 0,
				}),
				finalRuntime: runtime({
					currentSpace: 0,
					defaultLineId: "line:forge",
				}),
			}),
		);

		expect(text).toContain("### Default lines");
		expect(text).toContain("- Added: runtime:item:forge · line:forge");
		expect(text).not.toContain("No runtime change was observed");
	});
});
