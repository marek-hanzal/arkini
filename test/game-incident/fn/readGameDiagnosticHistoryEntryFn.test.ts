import { describe, expect, it } from "vitest";

import { formatGameDiagnosticHistoryTextFn } from "~/game-incident/fn/formatGameDiagnosticSessionTextFn";
import { readGameDiagnosticHistoryEntryFn } from "~/game-incident/fn/readGameDiagnosticHistoryEntryFn";
import { GameEventSchema } from "~/game-event/schema/GameEventSchema";
import type { GameTransition } from "~/game-session/type/GameSession";
import { createJobTestConfig } from "~test/production-job/support/jobTestConfig";

describe("readGameDiagnosticHistoryEntryFn", () => {
	it("marks bounded event detail and replaces raw item IDs with resolved identities", () => {
		const config = createJobTestConfig();
		const transition = {
			sequence: 1,
			previousRuntime: null,
			events: [
				{
					type: "job:started",
					jobId: "job:test",
					ownerItemId: "runtime:forge",
					ownerItemUid: "forge",
					targetItemUid: "water",
					note: "x".repeat(10_000),
				},
				GameEventSchema.parse({
					type: "item:merged",
					sourceItemId: "runtime:consumed",
					sourceItemUid: "water",
					targetItemId: "runtime:forge",
					targetItemUid: "forge",
					action: "consume",
					effect: "keep",
				}),
			],
			runtime: {
				cheats: {
					enabled: false,
					everEnabled: false,
					speedUpGameplay: false,
				},
				currentSpace: 0,
				templateUidBySpace: {},
				items: [
					{
						id: "runtime:forge",
						item: config.items.forge,
						location: {
							scope: "board",
							space: 0,
							position: {
								x: 0,
								y: 0,
							},
						},

						revision: "revision:test",
					},
				],
				jobs: [],
				jobQueue: [],
				defaultLineByOwnerItemId: {},
			},
		} as unknown as GameTransition;

		const entry = readGameDiagnosticHistoryEntryFn({
			config,
			elapsedSincePreviousMs: null,
			observedAt: "2026-09-01T10:00:00.000Z",
			transition,
		});

		expect(entry.truncated).toBe(true);
		expect(entry.events[1]?.relatedItems).toEqual([
			{
				runtimeItemId: "runtime:consumed",
				definition: null,
			},
			{
				runtimeItemId: "runtime:forge",
				definition: {
					itemUid: "forge",
					title: "forge",
				},
			},
			{
				runtimeItemId: null,
				definition: {
					itemUid: "water",
					title: "water",
				},
			},
		]);

		expect(entry.events[0]?.relatedItems).toEqual([
			{
				runtimeItemId: "runtime:forge",
				definition: {
					itemUid: "forge",
					title: "forge",
				},
			},
			{
				runtimeItemId: null,
				definition: {
					itemUid: "water",
					title: "water",
				},
			},
		]);
		expect(entry.events[0]?.details).toMatchObject({
			jobId: "job:test",
			note: "x".repeat(8_192),
		});
		expect(entry.events[0]?.details).not.toMatchObject({
			ownerItemId: expect.anything(),
		});
		const text = formatGameDiagnosticHistoryTextFn({
			retainedLimit: 32,
			totalEntries: 1,
			entries: [
				entry,
			],
		});
		expect(text.match(/config-uid forge/g)).toHaveLength(1);
		expect(text).toContain("Item: runtime:forge");
		expect(text).not.toContain("ownerItemId");
		expect(text).not.toContain("ownerItemUid");
		expect(text).not.toContain("targetItemUid");
	});
});
