import { Effect } from "effect";
import { afterEach, expect, it } from "vitest";
import { editorTestPayload } from "~test/project-authoring/support/editorTestPayload";
import { TemplateSchema } from "~/board-template/schema/TemplateSchema";
import {
	cleanupMcpHarnesses,
	connectMcpClient,
	createMcpHarness,
} from "./support/createMcpHarness";
import { toolJsonFn, toolTextFn } from "./graphQuery.test/fixture";

afterEach(cleanupMcpHarnesses);

it("renders canonical template coordinates with separate placement symbols, without changing saved data or JSON", async () => {
	const config = structuredClone(editorTestPayload.config);
	config.items.stone = {
		...config.items.water,
		uid: "stone",
		title: "Stone",
	};
	const templates = [
		{
			uid: "empty",
			title: "Empty",
			width: 3,
			height: 3,
			board: [],
		},
		{
			uid: "center",
			title: "Center",
			width: 3,
			height: 3,
			board: [
				{
					itemUid: "water",
					x: 1,
					y: 1,
				},
			],
		},
		{
			uid: "mixed",
			title: "Mixed",
			width: 4,
			height: 2,
			board: [
				{
					itemUid: "water",
					x: 3,
					y: 0,
				},
				{
					itemUid: "stone",
					x: 0,
					y: 1,
				},
				{
					itemUid: "water",
					x: 2,
					y: 1,
				},
			],
		},
		{
			uid: "symbols",
			title: "Symbols",
			width: 14,
			height: 2,
			board: Array.from(
				{
					length: 28,
				},
				(_, index) => ({
					itemUid: "water",
					x: index % 14,
					y: Math.floor(index / 14),
				}),
			),
		},
		{
			uid: "tall",
			title: "Tall",
			width: 1,
			height: 11,
			board: [
				{
					itemUid: "water",
					x: 0,
					y: 10,
				},
			],
		},
		{
			uid: "large",
			title: "Large",
			width: 10001,
			height: 1,
			board: [
				{
					itemUid: "water",
					x: 10000,
					y: 0,
				},
			],
		},
	].map((template) => TemplateSchema.parse(template));
	config.templates = [
		...config.templates!,
		...templates,
	];
	const { ownership, repository, port } = await createMcpHarness();
	const project = await Effect.runPromise(
		repository.createProjectFx({
			version: {
				major: 1,
				minor: 0,
			},
			config,
			resources: editorTestPayload.resources,
		}),
	);
	ownership.setProjectContextFn(project.projectId);
	await Effect.runPromise(ownership.startLocalFx);
	const client = await connectMcpClient(port);
	const results = new Map<string, string>();
	for (const template of templates) {
		const detail = await client.callTool({
			name: "template_detail",
			arguments: {
				templateUid: template.uid,
			},
		});
		expect(detail.isError).not.toBe(true);
		const text = toolTextFn(detail);
		results.set(template.uid, text);
		expect(text).toContain(`Template: ${template.title} [${template.uid}]`);
		expect(text).toContain(`Board: ${template.width} × ${template.height}`);
		expect(text).toContain(
			`Occupied: ${template.board.length} / ${template.width * template.height}`,
		);
		expect(text).toContain(`Free: ${template.width * template.height - template.board.length}`);
		const canonical = toolJsonFn(
			await client.callTool({
				name: "template_json",
				arguments: {
					templateUid: template.uid,
				},
			}),
		);
		expect(canonical).toEqual({
			revision: project.revision,
			template,
		});
	}
	expect(results.get("empty")).toContain(
		"```text\nx  0 1 2\ny\n0  . . .\n1  . . .\n2  . . .\n```",
	);
	expect(results.get("center")).toContain(
		"```text\nx  0 1 2\ny\n0  . . .\n1  . A .\n2  . . .\n```",
	);
	expect(results.get("center")).toContain("A = Water [item:water] @ (1,1)");
	expect(results.get("mixed")).toContain("```text\nx  0 1 2 3\ny\n0  . . . A\n1  B . C .\n```");
	for (const entry of [
		"A = Water [item:water] @ (3,0)",
		"B = Stone [item:stone] @ (0,1)",
		"C = Water [item:water] @ (2,1)",
	])
		expect(results.get("mixed")).toContain(entry);
	expect(results.get("symbols")).toContain("x   0  1  2  3  4  5  6  7  8  9 10 11 12 13");
	expect(results.get("symbols")).toContain("1   O  P  Q  R  S  T  U  V  W  X  Y  Z AA AB");
	expect(results.get("symbols")).toContain("AA = Water [item:water] @ (12,1)");
	expect(results.get("symbols")).toContain("AB = Water [item:water] @ (13,1)");
	expect(results.get("tall")).toContain(" x  0\ny\n 0  .");
	expect(results.get("tall")).toContain("\n10  A\n```");
	expect(results.get("large")).toContain(
		"Board map omitted: 10001 cells exceeds the 10000-cell rendering limit",
	);
	expect(results.get("large")).not.toContain("```text");
	expect(results.get("large")).toContain("A = Water [item:water] @ (10000,0)");
	expect((await Effect.runPromise(repository.readProjectFx(project.projectId)))?.config).toEqual(
		project.config,
	);
});
