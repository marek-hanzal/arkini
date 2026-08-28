import { Effect } from "effect";
import { afterEach, describe, expect, it } from "vitest";

import { editorTestPayload } from "~test/editor/support/editorTestPayload";
import {
	cleanupMcpHarnesses,
	connectMcpClient,
	createMcpHarness,
} from "./support/createMcpHarness";

afterEach(cleanupMcpHarnesses);

describe("editor MCP project validation", () => {
	it("returns readable semantic diagnostics rather than JSON", async () => {
		const { ownership, port, repository } = await createMcpHarness();
		await Effect.runPromise(
			repository.createProjectFx({
				version: "1.0",
				config: {
					...editorTestPayload.config,
					meta: {
						...editorTestPayload.config.meta,
						id: "invalid-project",
					},
					start: {
						...editorTestPayload.config.start,
						board: [
							{
								...editorTestPayload.config.start.board[0],
								itemId: "missing-item",
							},
						],
					},
				},
				resources: editorTestPayload.resources,
			}),
		);
		ownership.setProjectContext("invalid-project");
		await Effect.runPromise(ownership.startLocalFx);
		const client = await connectMcpClient(port);
		const result = await client.callTool({
			name: "validate_project",
			arguments: {},
		});

		expect(result).not.toHaveProperty("structuredContent");
		const text = result.content[0];
		if (text?.type !== "text") throw new Error("Missing validation text.");
		expect(text.text).toContain("Project validation");
		expect(text.text).toContain("Errors:");
		expect(text.text).toContain("Path: start.board.0.itemId");
		expect(text.text).toContain("Initial board references missing item missing-item.");
		expect(() => JSON.parse(text.text)).toThrow();
	});
});
