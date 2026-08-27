import * as NodeServices from "@effect/platform-node/NodeServices";
import { Effect, FileSystem } from "effect";
import { describe, expect, it, vi } from "vitest";

import { syncFilesystemPathFx } from "../../../src/engine/filesystem/internal/syncFilesystemPathFx";

describe("syncFilesystemPathFx", () => {
	it("does not open directories for unsupported Windows fsync", async () => {
		const nodeFileSystem = await Effect.runPromise(
			FileSystem.FileSystem.pipe(Effect.provide(NodeServices.layer)),
		);
		const open = vi.fn(nodeFileSystem.open);
		const platform = vi.spyOn(process, "platform", "get").mockReturnValue("win32");

		try {
			await Effect.runPromise(
				syncFilesystemPathFx(process.cwd()).pipe(
					Effect.provideService(FileSystem.FileSystem, {
						...nodeFileSystem,
						open,
					}),
				),
			);
			expect(open).not.toHaveBeenCalled();
		} finally {
			platform.mockRestore();
		}
	});
});
