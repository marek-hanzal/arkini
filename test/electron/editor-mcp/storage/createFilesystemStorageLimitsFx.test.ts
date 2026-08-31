import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Effect } from "effect";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createFilesystemEditorMcpStorageFx } from "~electron/main/editor-mcp/storage/createFilesystemEditorMcpStorageFx";

const directories: string[] = [];

afterEach(() => {
	vi.restoreAllMocks();
	for (const directory of directories.splice(0))
		rmSync(directory, {
			recursive: true,
			force: true,
		});
});

const createRoot = () => {
	const directory = mkdtempSync(join(tmpdir(), "arkini-mcp-storage-limit-test-"));
	directories.push(directory);
	return {
		directory,
		root: join(directory, "editor"),
	};
};

const createStorage = (
	root: string,
	unprotectFx: (value: Uint8Array) => Effect.Effect<Uint8Array, unknown> = (value) =>
		Effect.succeed(value),
) =>
	Effect.runPromise(
		createFilesystemEditorMcpStorageFx({
			root,
			protectFx: (value) => Effect.succeed(Buffer.from(value)),
			unprotectFx: (value) =>
				unprotectFx(value).pipe(Effect.map((bytes) => Buffer.from(bytes).toString())),
		}),
	);

describe("filesystem MCP storage limits", () => {
	it("does not touch the optional MCP path until MCP state is requested", async () => {
		const { root } = createRoot();
		writeFileSync(root, "not a directory");

		const storage = await createStorage(root);

		expect(storage).toBeDefined();
		await expect(Effect.runPromise(storage.readPortFx)).rejects.toThrow();
	});

	it("keeps local settings usable when the ngrok token cannot be decrypted", async () => {
		const { root } = createRoot();
		const configured = await createStorage(root);
		await Effect.runPromise(
			configured.writeNgrokFx({
				authtoken: "ngrok-token",
				domain: "mcp.example.com",
			}),
		);
		vi.spyOn(console, "error").mockImplementation(() => undefined);
		const reopened = await createStorage(root, () =>
			Effect.fail(new Error("Keychain unavailable")),
		);

		await expect(Effect.runPromise(reopened.readNgrokFx)).resolves.toBeUndefined();
		await expect(Effect.runPromise(reopened.readPortFx)).resolves.toBe(32_310);
	});

	it("bounds public OAuth client registration", async () => {
		const { root } = createRoot();
		mkdirSync(root, {
			recursive: true,
		});
		writeFileSync(
			join(root, "mcp.json"),
			JSON.stringify({
				port: 32_310,
				password: "arkini_mcp_fixture",
				clients: Array.from(
					{
						length: 100,
					},
					(_, index) => ({
						client_id: `client-${index}`,
						redirect_uris: [
							`https://client-${index}.example.com/callback`,
						],
					}),
				),
				authorizationCodes: [],
				accessTokens: [],
				refreshTokens: [],
			}),
		);
		const storage = await createStorage(root);
		const register = storage.model.registerClient;
		if (register === undefined) throw new Error("Expected dynamic client registration.");

		await expect(
			register({
				client_id: "client-over-limit",
				redirect_uris: [
					"https://client-over-limit.example.com/callback",
				],
			} as never),
		).rejects.toThrow("client limit reached");
	});
});
