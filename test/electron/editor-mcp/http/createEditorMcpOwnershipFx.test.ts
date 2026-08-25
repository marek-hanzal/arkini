import { createServer } from "node:http";
import { Effect } from "effect";
import { afterEach, describe, expect, it } from "vitest";

import { createEditorMcpOwnershipFx } from "../../../../electron/main/editor-mcp/http/createEditorMcpOwnershipFx";
import { createSqliteEditorProjectRepositoryFx } from "../../../../electron/main/editor-project/sqlite/fx/createSqliteEditorProjectRepositoryFx";
import {
	cleanupEditorMcpHarnesses,
	createEditorMcpHarness,
	registerEditorMcpCleanup,
} from "./support/createEditorMcpHarness";

afterEach(cleanupEditorMcpHarnesses);

describe("createEditorMcpOwnershipFx", () => {
	it("starts once, binds only the editor endpoint, and releases its port", async () => {
		const { ownership, port } = await createEditorMcpHarness();
		expect(ownership.readStatus()).toEqual({
			type: "inactive",
		});
		await expect(
			Promise.all([
				Effect.runPromise(ownership.activateFx),
				Effect.runPromise(ownership.activateFx),
			]),
		).resolves.toEqual([
			{
				port,
				type: "ready",
			},
			{
				port,
				type: "ready",
			},
		]);
		await expect(fetch(`http://127.0.0.1:${port}/other`)).resolves.toMatchObject({
			status: 404,
		});
		await expect(fetch(`http://127.0.0.1:${port}/mcp`)).resolves.toMatchObject({
			status: 404,
		});
		await Effect.runPromise(ownership.closeFx);
		const released = createServer();
		await new Promise<void>((resolve, reject) => {
			released.once("error", reject);
			released.listen(port, "127.0.0.1", resolve);
		});
		await new Promise<void>((resolve, reject) =>
			released.close((error) => (error === undefined ? resolve() : reject(error))),
		);
	});

	it("reports an occupied configured port without stealing the listener", async () => {
		const occupied = createServer();
		const port = await new Promise<number>((resolve, reject) => {
			occupied.once("error", reject);
			occupied.listen(0, "127.0.0.1", () => {
				const address = occupied.address();
				if (address === null || typeof address === "string") {
					reject(new Error("Expected occupied TCP port."));
					return;
				}
				resolve(address.port);
			});
		});
		registerEditorMcpCleanup(
			() =>
				new Promise<void>((resolve, reject) =>
					occupied.close((error) => (error === undefined ? resolve() : reject(error))),
				),
		);
		const repository = await Effect.runPromise(
			createSqliteEditorProjectRepositoryFx({
				databasePath: ":memory:",
			}),
		);
		registerEditorMcpCleanup(() => Effect.runPromise(repository.closeFx));
		const ownership = Effect.runSync(
			createEditorMcpOwnershipFx({
				editor: {
					type: "ready",
					repository,
				},
				notifyProjectChanged: () => undefined,
				readPortFx: Effect.succeed(port),
				runPromise: Effect.runPromise,
			}),
		);
		const status = await Effect.runPromise(ownership.activateFx);
		expect(status.type).toBe("unavailable");
		if (status.type === "unavailable") expect(status.message).toContain("EADDRINUSE");
		expect(occupied.listening).toBe(true);
	});

	it("stays unavailable without binding when editor persistence failed", () => {
		const ownership = Effect.runSync(
			createEditorMcpOwnershipFx({
				editor: {
					type: "unavailable",
					message: "SQLite failed.",
				},
				notifyProjectChanged: () => undefined,
				readPortFx: Effect.die("must not read"),
				runPromise: Effect.runPromise,
			}),
		);
		expect(Effect.runSync(ownership.activateFx)).toEqual({
			type: "unavailable",
			message: "SQLite failed.",
		});
	});
});
