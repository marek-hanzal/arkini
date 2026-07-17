import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("desktop delivery configuration", () => {
	it("packages only unsigned macOS arm64 DMG and ZIP artifacts", () => {
		const config = readFileSync("electron-builder.yml", "utf8");
		expect(config).toContain("appId: dev.marekhanzal.arkini");
		expect(config).toContain("identity: null");
		expect(config).toContain("icon: icon.png");
		expect(config).toContain("target: dmg");
		expect(config).toContain("target: zip");
		expect(config.match(/- arm64/g)).toHaveLength(2);
		expect(config).not.toContain("x64");
		expect(config).not.toContain("universal");
		expect(config).toContain("app: desktop-package");
		expect(config).toContain("- out/**/*");
		expect(config).toContain("- package.json");
	});
});
