import { GameConfigSchema } from "~/game-config/schema/GameConfigSchema";
import { createGraphProject, createToolProject } from "../support/createToolProject";

/** Isolates the multi-hop graph fixture from the shared MCP collection fixture. */
export const createRelationTraversalProject = () => {
	const base = createGraphProject();
	const forge = base.config.items.forge;
	if (forge.type !== "producer") throw new Error("Expected producer fixture.");
	const readOutput = (itemId: string) => ({
		set: [
			{
				roll: [
					{
						drop: [
							{
								itemId,
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
		inputItemId,
		outputItemId,
		title,
	}: {
		readonly id: string;
		readonly inputItemId: string;
		readonly outputItemId: string;
		readonly title: string;
	}) => ({
		...forge,
		id,
		title,
		uid: id,
		lines: forge.lines.map((line) => ({
			...line,
			description: `${title} relation fixture.`,
			id: `line:${id}:run`,
			input: [
				{
					...line.input[0],
					capacity: 1,
					mode: "consume" as const,
					quantity: {
						max: 1,
						min: 1,
					},
					selector: {
						itemId: inputItemId,
						type: "item" as const,
					},
					type: "materials" as const,
				},
			],
			output: readOutput(outputItemId),
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
					id: "dust",
					title: "Dust",
					uid: "dust",
				},
				ingot: readProducer({
					id: "ingot",
					inputItemId: "tool",
					outputItemId: "plate",
					title: "Ingot",
				}),
				kiln: readProducer({
					id: "kiln",
					inputItemId: "tool",
					outputItemId: "ingot",
					title: "Kiln",
				}),
				mill: readProducer({
					id: "mill",
					inputItemId: "forge",
					outputItemId: "dust",
					title: "Mill",
				}),
				plate: {
					...base.config.items.tool,
					id: "plate",
					title: "Plate",
					uid: "plate",
				},
			},
		}),
	);
};
