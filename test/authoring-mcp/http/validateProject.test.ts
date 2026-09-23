import { Effect } from "effect";
import { afterEach, describe, expect, it } from "vitest";

import { editorTestPayload } from "~test/project-authoring/support/editorTestPayload";
import { createTestPngBytes } from "~test/serapack-support/fn/createTestPngBytes";
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
				version: {
					major: 1,
					minor: 0,
				},
				config: {
					...editorTestPayload.config,
					meta: {
						...editorTestPayload.config.meta,
						id: "invalid-project",
					},
					templates: [
						{
							...editorTestPayload.config.templates![0],
							board: [
								{
									x: 0,
									y: 0,
									itemId: "missing-item",
								},
							],
						},
					],
				},
				resources: [
					...editorTestPayload.resources,
					{
						id: "unused-artwork",
						type: "artwork",
						bytes: createTestPngBytes(),
					},
				],
			}),
		);
		ownership.setProjectContextFn("invalid-project");
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
		expect(text.text).toContain("Path: templates.0.board.0.itemId");
		expect(text.text).toContain("Template Initial references missing item missing-item.");
		expect(text.text).toContain("[warning]");
		expect(() => JSON.parse(text.text)).toThrow();

		const errorsOnly = await client.callTool({
			name: "validate_project",
			arguments: {
				includeWarnings: false,
			},
		});
		const errorsOnlyText = errorsOnly.content[0];
		if (errorsOnlyText?.type !== "text") throw new Error("Missing validation text.");
		expect(errorsOnlyText.text).toContain("Errors:");
		expect(errorsOnlyText.text).toContain("Warnings: 1 (suppressed)");
		expect(errorsOnlyText.text).toContain("[error]");
		expect(errorsOnlyText.text).not.toContain("[warning]");
		expect(errorsOnlyText.text).not.toContain("unused-artwork");
	});
});
