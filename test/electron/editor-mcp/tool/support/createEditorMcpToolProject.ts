import type { EditorProject } from "~/editor/EditorProject";
import { GameConfigSchema } from "~/engine/schema/GameConfigSchema";
import { createJobTestConfig } from "~test/job/support/jobTestConfig";

export const createEditorMcpToolProject = (config: GameConfigSchema.Type): EditorProject => ({
	config,
	createdAtMs: 0,
	version: "1.0",
	projectId: "mcp-tool-test",
	resources: [],
	revision: 0,
	title: config.meta.title,
	updatedAtMs: 0,
});

export const createEditorMcpGraphProject = () => {
	const base = createJobTestConfig();
	const forge = base.items.forge;
	if (forge.type !== "producer") throw new Error("Expected producer fixture.");
	return createEditorMcpToolProject(
		GameConfigSchema.parse({
			...base,
			start: {
				...base.start,
				board: [
					{
						itemId: "forge",
						space: 0,
						x: 0,
						y: 0,
					},
				],
				inventory: [
					{
						itemId: "water",
						quantity: 3,
					},
					{
						itemId: "tool",
						quantity: 1,
					},
				],
			},
			items: {
				...base.items,
				forge: {
					...forge,
					lines: forge.lines.map((line) => ({
						...line,
						output: {
							set: [
								{
									roll: [
										{
											drop: [
												{
													itemId: "ingot",
													placement: "drop",
													quantity: {
														max: 1,
														min: 1,
													},
													rules: [],
												},
											],
											type: "guaranteed",
										},
									],
								},
							],
						},
					})),
				},
				ingot: {
					...base.items.tool,
					id: "ingot",
					title: "Ingot",
					uid: "ingot",
				},
				unused: {
					...base.items.tool,
					id: "unused",
					title: "Unused",
					uid: "unused",
				},
			},
		}),
	);
};
