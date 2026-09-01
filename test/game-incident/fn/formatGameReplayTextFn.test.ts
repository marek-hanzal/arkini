import { describe, expect, it } from "vitest";

import { formatGameReplayTextFn } from "~/game-incident/fn/formatGameReplayTextFn";
import type { GameDiagnosticRuntime } from "~/game-incident/type/GameDiagnosticRuntime";
import type { GameReplayReport } from "~/game-incident/type/GameReplayReport";

const runtime = ({
	currentSpace,
	quantity = 1,
	revision = "revision:initial",
}: {
	readonly currentSpace: number;
	readonly quantity?: number;
	readonly revision?: string;
}): GameDiagnosticRuntime => ({
	currentSpace,
	cheats: {
		enabled: false,
		everEnabled: false,
		instantGameplay: false,
	},
	items: [
		{
			item: {
				runtimeItemId: "runtime:item:forge",
				definition: {
					itemId: "forge",
					itemUid: "uid:forge",
					title: "Forge",
				},
			},
			revision,
			quantity,
			location: {
				scope: "board",
				space: 0,
			},
		},
	],
	jobs: [],
	queue: [],
	defaultLines: [],
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

	it("reports meaningful item changes without opaque revision churn", () => {
		const text = formatGameReplayTextFn(
			report({
				initialRuntime: runtime({
					currentSpace: 0,
				}),
				finalRuntime: runtime({
					currentSpace: 0,
					quantity: 2,
					revision: "revision:changed",
				}),
			}),
		);

		expect(text).toContain("quantity 1 → 2");
		expect(text).not.toContain("revision:");
	});
});
