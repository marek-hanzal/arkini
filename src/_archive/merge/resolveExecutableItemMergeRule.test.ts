import { describe, expect, it } from "vitest";
import { createEngineMergeTestConfig } from "~/engine/test/createEngineMergeTestConfig";
import { resolveExecutableItemMergeRule } from "~/merge/resolveExecutableItemMergeRule";

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
});
