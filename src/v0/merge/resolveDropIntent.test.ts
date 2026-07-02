import { describe, expect, it } from "vitest";
import type { BoardViewItem } from "~/v0/board/view/BoardViewItemSchema";
import type { ProducerLineView } from "~/v0/board/view/ProducerLineViewSchema";
import { createEngineTestConfig } from "~/v0/game/engine/test/createEngineTestConfig";
import { createEngineMergeTestConfig } from "~/v0/game/engine/test/createEngineMergeTestConfig";
import { resolveDropIntent } from "~/v0/merge/resolveDropIntent";
import { resolveItemToBoardItemInteractionPlan } from "~/v0/play/interaction/resolveItemToBoardItemInteractionPlan";

const config = createEngineTestConfig();
const directionalMergeConfig = createEngineMergeTestConfig();

const boardItem = (props: Omit<BoardViewItem, "state" | "x" | "y">): BoardViewItem => ({
	...props,
	state: {},
	x: 0,
	y: 0,
});

const activationTarget = (activation: NonNullable<BoardViewItem["activation"]>): BoardViewItem =>
	boardItem({
		activation,
		id: "target",
		itemId: "item:lumber-camp-1",
	});

const productLine = (overrides: Partial<ProducerLineView> = {}): ProducerLineView => ({
	durationMs: 1000,
	inProgress: false,
	isDefault: true,
	inputItemIds: [],
	inputs: [],
	inputsReady: true,
	inputsAvailable: true,
	name: "Test product",
	lineKind: "product" as const,
	producerQueuedJobs: 0,
	lineId: "line:test",
	progress: undefined,
	queueFull: false,
	blocked: false,
	queuedJobs: 0,
	queueSize: 1,
	...overrides,
});

describe("resolveDropIntent", () => {
	it("uses only source-owned explicit merge rules", () => {
		expect(
			resolveDropIntent({
				config: directionalMergeConfig,
				sourceItemId: "item:water",
				targetItem: boardItem({
					id: "target",
					itemId: "item:twig",
				}),
			}),
		).toEqual({
			resultItemId: "item:sprout",
			type: "merge",
		});

		expect(
			resolveDropIntent({
				config: directionalMergeConfig,
				sourceItemId: "item:twig",
				targetItem: boardItem({
					id: "target",
					itemId: "item:water",
				}),
			}),
		).toEqual({
			type: "swap",
		});
	});
	it("keeps regular merge as the first merge-like board interaction", () => {
		expect(
			resolveDropIntent({
				config,
				sourceItemId: "item:twig",
				targetItem: boardItem({
					id: "target",
					itemId: "item:twig",
				}),
			}),
		).toEqual({
			resultItemId: "item:plank",
			type: "merge",
		});
	});

	it("prefers the default producer producer line when multiple lines accept the same input", () => {
		expect(
			resolveItemToBoardItemInteractionPlan({
				config,
				sourceItemId: "item:twig",
				targetItem: activationTarget({
					inputs: [],
					kind: "producer",
					producerLines: [
						productLine({
							inputs: [
								{
									capacity: 1,
									consume: true,
									itemId: "item:twig",
									quantity: 1,
									stored: 0,
								},
							],
							isDefault: false,
							lineId: "line:test",
						}),
						productLine({
							inputs: [
								{
									capacity: 1,
									consume: true,
									itemId: "item:twig",
									quantity: 1,
									stored: 0,
								},
							],
							isDefault: true,
							lineId: "line:shred",
						}),
					],
					trigger: "click",
				}),
			}),
		).toEqual({
			feedbackVariant: "secondary",
			lineId: "line:shred",
			type: "producer-input",
		});
	});

	it("routes stash inputs before the swap fallback", () => {
		expect(
			resolveDropIntent({
				config,
				sourceItemId: "item:twig",
				targetItem: activationTarget({
					inputs: [
						{
							capacity: 1,
							consume: true,
							itemId: "item:twig",
							quantity: 1,
							stored: 0,
						},
					],
					kind: "stash",
					trigger: "click",
				}),
			}),
		).toEqual({
			type: "stash-input",
		});
	});
});
