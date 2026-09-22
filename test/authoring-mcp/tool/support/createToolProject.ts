import type { Project } from "~/project-authoring/type/Project";
import { GameConfigSchema } from "~/game-config/schema/GameConfigSchema";
import { createJobTestConfig } from "~test/production-job/support/jobTestConfig";

export const createToolProject = (config: GameConfigSchema.Type): Project => ({
	config,
	createdAtMs: 0,
	version: {
		major: 1,
		minor: 0,
	},
	projectId: "mcp-tool-test",
	resources: [],
	revision: 0,
	title: config.meta.title,
	updatedAtMs: 0,
});

export const createGraphProject = () => {
	const base = createJobTestConfig();
	const forge = base.items.forge;
	return createToolProject(
		GameConfigSchema.parse({
			...base,
			start: {
				...base.start,
				board: [
					{
						itemId: "water",
						space: 0,
						x: 3,
						y: 0,
					},
					{
						itemId: "water",
						space: 0,
						x: 4,
						y: 0,
					},
					{
						itemId: "water",
						space: 0,
						x: 1,
						y: 0,
					},
					{
						itemId: "tool",
						space: 0,
						x: 2,
						y: 0,
					},
					{
						itemId: "forge",
						space: 0,
						x: 0,
						y: 0,
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
									rules: [],
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
