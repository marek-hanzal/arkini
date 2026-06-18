import { describe, expect, it } from "vitest";
import { defaultGameConfig } from "~/v0/game/compiled/defaultGameConfig";
import {
	hasReverseDirectedItemMergeRule,
	resolveExecutableItemMergeRule,
} from "~/v0/game/engine/logic/resolveExecutableItemMergeRule";

describe("resolveExecutableItemMergeRule", () => {
	it("resolves regular combo merges from either drag direction", () => {
		expect(
			resolveExecutableItemMergeRule({
				config: defaultGameConfig,
				sourceItemId: "item:twig",
				targetItemId: "item:water",
			}),
		).toMatchObject({
			directed: false,
			merge: {
				resultItemId: "item:sprout",
				withItemId: "item:water",
			},
			ruleOwnerItemId: "item:twig",
		});

		expect(
			resolveExecutableItemMergeRule({
				config: defaultGameConfig,
				sourceItemId: "item:water",
				targetItemId: "item:twig",
			}),
		).toMatchObject({
			directed: false,
			merge: {
				resultItemId: "item:sprout",
				withItemId: "item:water",
			},
			ruleOwnerItemId: "item:twig",
		});
	});

	it("keeps imprint merges directed", () => {
		expect(
			resolveExecutableItemMergeRule({
				config: defaultGameConfig,
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
				config: defaultGameConfig,
				sourceItemId: "item:blueprint",
				targetItemId: "item:lumber-camp-1",
			}),
		).toBeUndefined();
		expect(
			hasReverseDirectedItemMergeRule({
				config: defaultGameConfig,
				sourceItemId: "item:blueprint",
				targetItemId: "item:lumber-camp-1",
			}),
		).toBe(true);
	});
});
