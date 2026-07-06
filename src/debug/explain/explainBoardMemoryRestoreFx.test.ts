import { Effect } from "effect";
import { describe, expect, it } from "vitest";
import { explainBoardMemoryRestoreFx } from "~/debug/explain/explainBoardMemoryRestoreFx";
import { createEngineTestConfig } from "~/engine/test/createEngineTestConfig";
import { createGameScenario } from "~/engine/test/GameScenario";

const runExplain = (props: Parameters<typeof explainBoardMemoryRestoreFx>[0]) =>
	Effect.runSync(explainBoardMemoryRestoreFx(props));

describe("explainBoardMemoryRestoreFx", () => {
	it("explains missing memory layout", () => {
		const config = createEngineTestConfig();
		const scenario = createGameScenario({
			config,
		});

		expect(
			runExplain({
				boardItemId: "memory",
				config,
				nowMs: scenario.nowMs,
				save: scenario.save,
			}),
		).toMatchObject({
			outcome: "blocked",
			steps: expect.arrayContaining([
				expect.objectContaining({
					code: "blocked_missing_memory_layout",
				}),
			]),
		});
	});

	it("explains best-effort restore when saved layout items are missing", () => {
		const config = createEngineTestConfig({
			game: {
				id: "game:test",
				title: "Test",
				board: {
					height: 1,
					width: 3,
				},
				inventory: {
					slots: 3,
				},
			},
		});
		const scenario = createGameScenario({
			config,
		})
			.withBoardItems([
				{
					id: "memory",
					itemId: "item:producer",
					x: 0,
					y: 0,
				},
			])
			.withInventorySlots([
				{
					itemId: "item:twig",
					quantity: 1,
				},
			])
			.withBoardMemoryLayout({
				boardItemId: "memory",
				items: [
					{
						itemId: "item:twig",
						x: 1,
						y: 0,
					},
					{
						itemId: "item:plank",
						x: 2,
						y: 0,
					},
				],
			});

		expect(
			runExplain({
				boardItemId: "memory",
				config,
				nowMs: scenario.nowMs,
				save: scenario.save,
			}),
		).toMatchObject({
			outcome: "partial",
			steps: expect.arrayContaining([
				expect.objectContaining({
					code: "partial_layout_restore",
					details: expect.objectContaining({
						restoredCount: 1,
						skippedCount: 1,
					}),
				}),
			]),
		});
	});
});
