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
			templates: [
				{
					uid: "initial",
					title: "Initial",
					...base.meta.board,
					board: [
						{
							itemUid: "water",
							x: 3,
							y: 0,
						},
						{
							itemUid: "water",
							x: 4,
							y: 0,
						},
						{
							itemUid: "water",
							x: 1,
							y: 0,
						},
						{
							itemUid: "tool",
							x: 2,
							y: 0,
						},
						{
							itemUid: "forge",
							x: 0,
							y: 0,
						},
					],
				},
			],
			start: {
				currentSpace: 0,
				spaces: [
					{
						space: 0,
						templateUid: "initial",
					},
				],
			},
			items: {
				...base.items,
				forge: {
					...forge,
					lines: forge.lines.map((line) => ({
						...line,
						outcome: {
							set: [
								{
									rules: [],
									roll: [
										{
											outcome: [
												{
													type: "item",
													itemUid: "ingot",
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

					title: "Ingot",
					uid: "ingot",
				},
				unused: {
					...base.items.tool,

					title: "Unused",
					uid: "unused",
				},
			},
		}),
	);
};
