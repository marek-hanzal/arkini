import { describe, expect, it } from "vitest";
import { createEngineMergeTestConfig } from "~/v0/game/engine/test/createEngineMergeTestConfig";
import {
	hasReverseDirectedItemMergeRule,
	resolveExecutableItemMergeRule,
} from "~/v0/game/engine/logic/resolveExecutableItemMergeRule";

const config = createEngineMergeTestConfig();

describe("resolveExecutableItemMergeRule", () => {
	it("resolves only source-owned explicit merge rules", () => {
		expect(
			resolveExecutableItemMergeRule({
				config,
				sourceItemId: "item:water",
				targetItemId: "item:twig",
			}),
		).toMatchObject({
			directed: false,
			merge: {
				resultItemId: "item:sprout",
				withItemId: "item:twig",
			},
			ruleOwnerItemId: "item:water",
		});

		expect(
			resolveExecutableItemMergeRule({
				config,
				sourceItemId: "item:twig",
				targetItemId: "item:water",
			}),
		).toBeUndefined();
	});

	it("keeps imprint merges directed", () => {
		expect(
			resolveExecutableItemMergeRule({
				config,
				sourceItemId: "item:lumber-camp-1",
				targetItemId: "item:blueprint",
			}),
		).toMatchObject({
			directed: true,
			merge: {
				consumeSource: false,
				resultItemId: "item:blueprint-lumber-camp",
				withItemId: "item:blueprint",
			},
			ruleOwnerItemId: "item:lumber-camp-1",
		});

		expect(
			resolveExecutableItemMergeRule({
				config,
				sourceItemId: "item:blueprint",
				targetItemId: "item:lumber-camp-1",
			}),
		).toBeUndefined();
		expect(
			hasReverseDirectedItemMergeRule({
				config,
				sourceItemId: "item:blueprint",
				targetItemId: "item:lumber-camp-1",
			}),
		).toBe(true);
	});
});
