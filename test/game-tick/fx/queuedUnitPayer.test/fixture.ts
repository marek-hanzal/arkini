import { GameConfigSchema } from "~/game-config/schema/GameConfigSchema";
import type { InputSchema } from "~/production-input/schema/InputSchema";
import { base, targetUnitInput } from "~test/production-action/fx/itemUnits.test/fixture";

const line = (id: string, input: InputSchema.Type[]) => ({
	id,
	title: id,
	description: id,
	runtimeMs: 5_000,
	input,
	rules: [],
});
export const createConfig = (amount = 1, inputCount = 1) =>
	GameConfigSchema.parse({
		resources: {
			hero: "hero",
		},
		meta: {
			id: "queued-unit",
			title: "Queued unit",
			board: {
				width: 5,
				height: 2,
			},
		},
		templates: [
			{
				uid: "start",
				title: "Start",
				width: 5,
				height: 2,
				board: [],
			},
		],
		start: {
			currentSpace: 0,
			spaces: [
				{
					space: 0,
					templateUid: "start",
				},
			],
		},
		items: {
			payer: {
				...base({
					id: "payer",
				}),

				units: {
					amount,
				},
				maxQueueSize: 2,
				lines: [
					line("wait", [
						{
							type: "materials",
							mode: "consume",
							query: {
								distance: "far",
								selector: {
									type: "item",
									itemUid: "absent",
								},
							},
							quantity: {
								min: 1,
								max: 1,
							},
						},
					]),
					line("free", [
						{
							type: "simple",
						},
					]),
					line("self", [
						{
							...targetUnitInput("payer"),
							query: {
								...targetUnitInput("payer").query,
								distance: "self",
							},
						},
					]),
				],
			},
			consumer: {
				...base({
					id: "consumer",
				}),

				maxQueueSize: 1,
				lines: [
					line(
						"work",
						Array.from(
							{
								length: inputCount,
							},
							() => targetUnitInput("payer"),
						),
					),
				],
			},
			independent: {
				...base({
					id: "independent",
				}),

				maxQueueSize: 1,
				lines: [
					line("free", [
						{
							type: "simple",
						},
					]),
				],
			},
			absent: {
				maxQueueSize: 1,
				lines: [],

				...base({
					id: "absent",
				}),
			},
		},
	});
