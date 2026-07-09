import ArkiniGameConfig from "../../../game/arkini/game.json";
import { describe, expect, it } from "vitest";

import { GameSchema } from "./GameSchema";

describe("GameSchema", () => {
	it("parses the current Arkini game configuration", () => {
		expect(GameSchema.safeParse(ArkiniGameConfig).success).toBe(true);
	});
});
