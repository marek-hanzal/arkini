import { describe, expect, it } from "vitest";
import { defaultGameConfig } from "~/v0/game/compiled/defaultGameConfig";

describe("defaultGameConfig", () => {
	it("is compiled to the line-owned effect model without legacy mutator fields", () => {
		expect(JSON.stringify(defaultGameConfig)).not.toContain("grantSelector");
		expect(JSON.stringify(defaultGameConfig.effects)).not.toContain("operations");
	});

	it("keeps passive effects as global grant sources", () => {
		expect(defaultGameConfig.effects["effect:shrine-minor-haste"]).toMatchObject({
			grants: [
				{
					id: "grant:active:shrine-minor-haste",
					name: "Minor Haste active",
				},
			],
		});
	});

	it("authors work requirements directly on product lines", () => {
		expect(defaultGameConfig.products["product:lumberjack-t1:log"]?.effects?.[0]).toMatchObject(
			{
				display: "always",
				kind: "nearby.require",
				phase: "start",
			},
		);
	});
});
