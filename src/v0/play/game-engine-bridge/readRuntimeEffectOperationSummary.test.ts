import { describe, expect, it } from "vitest";
import { defaultGameConfig } from "~/v0/game/compiled/defaultGameConfig";
import { readRuntimeEffectBenefitLines } from "~/v0/play/game-engine-bridge/readRuntimeEffectOperationSummary";

describe("readRuntimeEffectBenefitLines", () => {
	it("describes shrine speed boosts in player-readable copy", () => {
		expect(
			readRuntimeEffectBenefitLines({
				config: defaultGameConfig,
				effectId: "effect:shrine-minor-haste",
			}),
		).toEqual([
			"25% faster production for Grain, Log, Stone, Plank, Vegetables, Water.",
		]);
	});

	it("describes shrine quantity boosts in player-readable copy", () => {
		expect(
			readRuntimeEffectBenefitLines({
				config: defaultGameConfig,
				effectId: "effect:shrine-bountiful-offering",
			}),
		).toEqual([
			"Produces +1 extra item per output for Grain, Log, Stone, Plank, Vegetables, Water.",
		]);
	});
});
