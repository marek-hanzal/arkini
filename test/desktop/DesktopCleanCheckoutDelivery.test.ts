import { readFile, readdir, stat } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createCleanDeliveryWorkspace } from "./DesktopCleanCheckoutDelivery.test/createCleanDeliveryWorkspace";
import { runPackagedCliVersion } from "./DesktopCleanCheckoutDelivery.test/runPackagedCliVersion";

const bundledArkpackNames = [
	"arkini.game.arkpack",
	"arkini.game.arkpack.sig",
] as const;
const maxPackagedAsarBytes = 25 * 1024 * 1024;

describe("fresh checkout desktop delivery inputs", () => {
	it("builds and packages bundled Arkpacks from a clean checkout", async () => {
		const workspace = await createCleanDeliveryWorkspace();
		try {
			expect(await workspace.readStatus()).toBe("");
			await expect(
				stat(join(workspace.root, "game/arkini.game.arkpack")),
			).rejects.toMatchObject({
				code: "ENOENT",
			});
			await expect(
				stat(join(workspace.root, "game/arkini.game.arkpack.metadata.json")),
			).rejects.toMatchObject({
				code: "ENOENT",
			});
			await expect(stat(join(workspace.root, ".out"))).rejects.toMatchObject({
				code: "ENOENT",
			});
			await workspace.runRepositoryCommand("package-macos");
			const packed = await stat(join(workspace.root, "game/arkini.game.arkpack"));
			expect(packed.isFile()).toBe(true);
			const signature = await stat(join(workspace.root, "game/arkini.game.arkpack.sig"));
			expect(signature.isFile()).toBe(true);
			await expect(
				stat(join(workspace.root, "game/arkini.game.arkpack.metadata.json")),
			).rejects.toMatchObject({
				code: "ENOENT",
			});
			const renderer = await stat(
				join(workspace.root, ".out/desktop/build/renderer/index.html"),
			);
			expect(renderer.isFile()).toBe(true);
			await expect(
				stat(join(workspace.root, ".out/desktop/build/renderer/arkpacks")),
			).rejects.toMatchObject({
				code: "ENOENT",
			});

			const packagedGame = join(
				workspace.root,
				".out/desktop/release",
				"mac-arm64/Arkini.app/Contents/Resources/game",
			);
			expect((await readdir(packagedGame)).sort()).toEqual(bundledArkpackNames);
			for (const name of bundledArkpackNames) {
				expect(await readFile(join(packagedGame, name))).toEqual(
					await readFile(join(workspace.root, "game", name)),
				);
			}
			const packagedAsar = await stat(
				join(
					workspace.root,
					".out/desktop/release/mac-arm64/Arkini.app/Contents/Resources/app.asar",
				),
			);
			expect(packagedAsar.size).toBeLessThanOrEqual(maxPackagedAsarBytes);
			const packagedCli = await runPackagedCliVersion(workspace.root);
			expect(packagedCli.output).toContain(packagedCli.expectedVersion);
			expect(await workspace.readStatus()).toBe("");
		} finally {
			await workspace.dispose();
		}
	}, 300_000);
});
