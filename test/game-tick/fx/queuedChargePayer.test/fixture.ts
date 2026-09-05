import { GameConfigSchema } from "~/game-config/schema/GameConfigSchema";
import type { InputSchema } from "~/production-input/schema/InputSchema";
import { base, targetChargeInput } from "~test/production-action/fx/itemCharges.test/fixture";

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
			id: "queued-charge",
			title: "Queued charge",
			board: {
				width: 5,
				height: 2,
			},
			inventory: {
				width: 1,
				height: 1,
			},
		},
		start: {
			currentSpace: 0,
		},
		items: {
			payer: {
				...base({
					id: "payer",
				}),
				type: "deposit",
				charges: {
					amount,
				},
				maxQueueSize: 2,
				lines: [
					line("wait", [
						{
							type: "materials",
							mode: "consume",
							selector: {
								type: "item",
								itemId: "absent",
							},
							quantity: {
								min: 1,
								max: 1,
							},
							capacity: 0,
						},
					]),
					line("free", [
						{
							type: "simple",
						},
					]),
					line("self", [
						{
							...targetChargeInput("payer"),
							query: {
								...targetChargeInput("payer").query,
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
				type: "producer",
				maxQueueSize: 1,
				lines: [
					line(
						"work",
						Array.from(
							{
								length: inputCount,
							},
							() => targetChargeInput("payer"),
						),
					),
				],
			},
			independent: {
				...base({
					id: "independent",
				}),
				type: "producer",
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
				...base({
					id: "absent",
				}),
				type: "simple",
			},
		},
	});
