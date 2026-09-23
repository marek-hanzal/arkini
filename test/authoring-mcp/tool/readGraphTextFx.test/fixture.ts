import { GameConfigSchema } from "~/game-config/schema/GameConfigSchema";
import { createGraphProject, createToolProject } from "../support/createToolProject";

/** Isolates the multi-hop graph fixture from the shared MCP collection fixture. */
export const createRelationTraversalProject = () => {
	const base = createGraphProject();
	const forge = base.config.items.forge;
	const readOutput = (itemUid: string) => ({
		set: [
			{
				rules: [],
				roll: [
					{
						outcome: [
							{
								type: "item",
								itemUid,
								placement: "drop" as const,
								quantity: {
									max: 1,
									min: 1,
								},
								rules: [],
							},
						],
						type: "guaranteed" as const,
					},
				],
			},
		],
	});
	const readProducer = ({
		id,
		inputItemUid,
		outputItemUid,
		title,
	}: {
		readonly id: string;
		readonly inputItemUid: string;
		readonly outputItemUid: string;
		readonly title: string;
	}) => ({
		...forge,

		title,
		uid: id,
		lines: forge.lines.map((line) => ({
			...line,
			description: `${title} relation fixture.`,
			id: `line:${id}:run`,
			input: [
				{
					...line.input[0],
					mode: "consume" as const,
					quantity: {
						max: 1,
						min: 1,
					},
					query: {
						distance: "far",
						selector: {
							itemUid: inputItemUid,
							type: "item" as const,
						},
					},
					type: "materials" as const,
				},
			],
			outcome: readOutput(outputItemUid),
			title: `${title} Run`,
		})),
	});
	return createToolProject(
		GameConfigSchema.parse({
			...base.config,
			items: {
				...base.config.items,
				dust: {
					...base.config.items.tool,

					title: "Dust",
					uid: "dust",
				},
				ingot: readProducer({
					id: "ingot",
					inputItemUid: "tool",
					outputItemUid: "plate",
					title: "Ingot",
				}),
				kiln: readProducer({
					id: "kiln",
					inputItemUid: "tool",
					outputItemUid: "ingot",
					title: "Kiln",
				}),
				mill: readProducer({
					id: "mill",
					inputItemUid: "forge",
					outputItemUid: "dust",
					title: "Mill",
				}),
				plate: {
					...base.config.items.tool,

					title: "Plate",
					uid: "plate",
				},
			},
		}),
	);
};
