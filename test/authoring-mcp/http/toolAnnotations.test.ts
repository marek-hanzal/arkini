import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";
import { Effect } from "effect";
import { afterEach, expect, it } from "vitest";
import {
	cleanupMcpHarnesses,
	createMcpHarness,
	registerMcpCleanup,
} from "./support/createMcpHarness";

afterEach(cleanupMcpHarnesses);

it.each([
	"2025-11-25",
	"2026-07-28",
] as const)(
	"publishes accurate client risk and replay hints over %s without output schemas",
	async (version) => {
		const { ownership, port } = await createMcpHarness();
		await Effect.runPromise(ownership.startLocalFx);
		const client = new Client(
			{
				name: "tool-annotations-test",
				version: "1.0.0",
			},
			{
				versionNegotiation: {
					mode:
						version === "2025-11-25"
							? "legacy"
							: {
									pin: version,
								},
				},
			},
		);
		registerMcpCleanup(() => client.close());
		await client.connect(
			new StreamableHTTPClientTransport(new URL(`http://127.0.0.1:${port}/editor/mcp`)),
		);
		const catalog = await client.listTools();
		const additive = new Set([
			"create_item",
			"create_item_line",
			"create_template",
			"create_note",
		]);
		const replacements = new Set([
			"edit_item",
			"replace_item_line",
			"delete_item_line",
			"edit_item_lines",
			"item_line_order",
			"edit_project",
			"edit_project_layout",
			"set_start_space",
			"remove_start_space",
			"rename_item",
			"delete_item",
			"edit_template",
			"edit_template_cells",
			"delete_template",
			"edit_note",
			"delete_note",
		]);
		const unguarded = new Set([
			"create_item",
			"create_note",
			"edit_item",
			"edit_project",
			"rename_item",
		]);
		expect(
			catalog.tools.find(({ name }) => name === "artwork_collection")?.annotations,
		).toEqual({
			readOnlyHint: true,
			destructiveHint: false,
			idempotentHint: true,
			openWorldHint: false,
		});
		for (const tool of catalog.tools) {
			expect(tool.annotations, tool.name).toEqual({
				readOnlyHint: !additive.has(tool.name) && !replacements.has(tool.name),
				destructiveHint: replacements.has(tool.name),
				idempotentHint: !unguarded.has(tool.name),
				openWorldHint: false,
			});
			expect(tool.outputSchema, tool.name).toBeUndefined();
		}
	},
);
