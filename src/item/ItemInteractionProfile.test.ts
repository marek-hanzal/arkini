import { describe, expect, it } from "vitest";
import { boardMemoryItemId } from "~/board-memory/GameBoardMemoryItem";
import { cheatSpeedDisableItemId } from "~/cheat/GameCheatSpeedItem";
import { createEngineTestConfig } from "~/engine/test/createEngineTestConfig";
import {
	readItemInteractionProfile,
	readItemSpecialInteractionKind,
} from "~/item/ItemInteractionProfile";

const config = createEngineTestConfig();

describe("ItemInteractionProfile", () => {
	it("reads stack and merge capabilities from config", () => {
		const profile = readItemInteractionProfile({
			config,
			itemId: "item:twig",
		});

		expect(profile.stackKey).toBe("item:twig");
		expect(profile.hasExplicitMergeRules).toBe(true);
		expect(profile.mergeTargetIds).toContain("item:twig");
	});

	it("reads special interaction kinds from dedicated item ids", () => {
		expect(readItemSpecialInteractionKind(boardMemoryItemId)).toBe("memory");
		expect(readItemSpecialInteractionKind(cheatSpeedDisableItemId)).toBe("clock");
		expect(readItemSpecialInteractionKind("item:nuke-save")).toBe("nuke-save");
		expect(readItemSpecialInteractionKind("item:twig")).toBe("none");
	});
});
