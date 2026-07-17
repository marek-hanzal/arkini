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

	it("keeps one canonical Effect CLI packaging command as the CI build path", () => {
		expect(packageJson.scripts["package:mac"]).toBe(
			"tsx cli/arkini.ts desktop package --arch arm64",
		);
		expect(packageJson.scripts["package:clean"]).toContain("cli/arkini.ts desktop clean");
		expect(packageJson.scripts["package:stage"]).toContain("cli/arkini.ts desktop stage");
		expect(packageJson.scripts["package:checksums"]).toContain(
			"cli/arkini.ts desktop checksums",
		);
		expect(packageJson.scripts["package:verify"]).toContain("cli/arkini.ts desktop verify");
		expect("predc" in packageJson.scripts).toBe(false);
		expect("prepreview" in packageJson.scripts).toBe(false);

		const workflow = readFileSync(".github/workflows/macos-prerelease.yml", "utf8");
		expect(workflow).toContain('tags:\n      - "v*-dev.*"');
		expect(workflow).toContain("workflow_dispatch:");
		expect(workflow).toContain("runs-on: macos-15");
		expect(workflow).toContain("node-version: 24.18.0");
		expect(workflow).toContain('test "$(node --version)" = "v24.18.0"');
		expect(workflow).toContain('test "$(npm --version)" = "11.16.0"');
		expect(workflow).toContain("npm run format:check");
		expect(workflow).toContain("npm run dc");
		expect(workflow).toContain("npm run typecheck");
		expect(workflow).toContain("npm run game:validate");
		expect(workflow).toContain("run: npm run package:mac");
		expect(workflow).toContain("run: npm run test:shards");
		expect(workflow).not.toContain("run: npm run check");
		expect(workflow.match(/npm run package:mac/g)).toHaveLength(1);
		expect(workflow.indexOf("run: npm run package:mac")).toBeLessThan(
			workflow.indexOf("run: npm run test:shards"),
		);
		expect(workflow).toContain("gh release create");
		expect(workflow).toContain("--prerelease");
		expect(workflow).toContain("release/SHA256SUMS");
	});
});
