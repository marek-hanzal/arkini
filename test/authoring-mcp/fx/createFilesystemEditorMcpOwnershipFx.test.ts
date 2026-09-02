import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import * as NodeServices from "@effect/platform-node/NodeServices";
import { Effect } from "effect";
import { afterEach, describe, expect, it } from "vitest";

import { createFilesystemEditorMcpOwnershipFx } from "~/authoring-mcp/fx/createFilesystemEditorMcpOwnershipFx";
import type { OwnedEditorProjectRepository } from "~/project-authoring/service/EditorProjectServiceOwnership";
import {
	cleanupMcpHarnesses,
	connectMcpClient,
	createProjectRepository,
	registerMcpCleanup,
	reserveReleasedPort,
} from "../http/support/createMcpHarness";

afterEach(cleanupMcpHarnesses);

describe("filesystem Editor MCP ownership", () => {
	it("interrupts an in-flight tool before close settles", async () => {
		const repository = await createProjectRepository();
		const directory = await mkdtemp(join(tmpdir(), "arkini-editor-mcp-owner-"));
		registerMcpCleanup(() =>
			rm(directory, {
				force: true,
				recursive: true,
			}),
		);
		let announceReadFn: () => void = () => undefined;
		const readStarted = new Promise<void>((resolveFn) => {
			announceReadFn = resolveFn;
		});
		let finalized = false;
		const blockingRepository: OwnedEditorProjectRepository = {
			...repository,
			readProjectFx: () =>
				Effect.sync(announceReadFn).pipe(
					Effect.andThen(Effect.never),
					Effect.ensuring(Effect.sync(() => (finalized = true))),
				),
		};
		const ownership = await Effect.runPromise(
			createFilesystemEditorMcpOwnershipFx({
				editor: {
					type: "ready",
					repository: blockingRepository,
				},
				notifyOverviewChangedFn: () => undefined,
				notifyProjectChangedFn: () => undefined,
				root: join(directory, "editor"),
			}).pipe(Effect.provide(NodeServices.layer)),
		);
		registerMcpCleanup(() => Effect.runPromise(ownership.closeFx));
		const port = await reserveReleasedPort();
		await Effect.runPromise(
			ownership.configureFx({
				type: "port",
				port,
			}),
		);
		ownership.setProjectContextFn("blocked-project");
		await Effect.runPromise(ownership.startLocalFx);
		const client = await connectMcpClient(port);
		const call = client
			.callTool({
				name: "project",
				arguments: {},
			})
			.catch(() => undefined);

		await readStarted;
		await Effect.runPromise(ownership.closeFx);
		expect(finalized).toBe(true);
		await call;
	});
});
