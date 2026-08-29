import type { EditorProject } from "~/editor/EditorProject";
import { GameConfigSchema } from "~/game-config/GameConfigSchema";
import { createJobTestConfig } from "~test/job/support/jobTestConfig";

export const createToolProject = (config: GameConfigSchema.Type): EditorProject => ({
	config,
	createdAtMs: 0,
	version: "1.0",
	projectId: "mcp-tool-test",
	resources: [],
	revision: 0,
	title: config.meta.title,
	updatedAtMs: 0,
});

export const createGraphProject = () => {
	const base = createJobTestConfig();
	const forge = base.items.forge;
	if (forge.type !== "producer") throw new Error("Expected producer fixture.");
	return createToolProject(
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
						position: {
							x: 0,
							y: 0,
						},
						quantity: 3,
					},
					{
						itemId: "tool",
						position: {
							x: 1,
							y: 0,
						},
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
