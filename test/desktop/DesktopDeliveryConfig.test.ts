import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import packageJson from "../../package.json" with { type: "json" };

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

	it("keeps one local packaging command as the CI build path", () => {
		expect(packageJson.scripts["package:mac"]).toContain("electron-builder");
		expect(packageJson.scripts["package:mac"]).toContain("package:stage");
		expect(packageJson.scripts["package:mac"]).toContain("--arm64");
		expect(packageJson.scripts["package:mac"]).toContain("package:checksums");
		expect(packageJson.scripts["package:mac"]).toContain("package:verify");

		const workflow = readFileSync(".github/workflows/macos-prerelease.yml", "utf8");
		expect(workflow).toContain('tags:\n      - "v*-dev.*"');
		expect(workflow).toContain("workflow_dispatch:");
		expect(workflow).toContain("runs-on: macos-15");
		expect(workflow).toContain("run: npm run package:mac");
		expect(workflow).toContain("gh release create");
		expect(workflow).toContain("--prerelease");
		expect(workflow).toContain("release/SHA256SUMS");
	});
});
