import { Equal } from "effect";
import { describe, expect, it } from "vitest";

import type { useItemDefinitionDetail } from "~/bridge/item-detail/useItemDefinitionDetail";
import type { useItemDetailIdentity } from "~/bridge/item-detail/useItemDetailIdentity";
import type { useItemDetailQueue } from "~/bridge/item-detail/useItemDetailQueue";
import type { useItemDetailSources } from "~/bridge/item-detail/useItemDetailSources";
import type { useItemDetailTabs } from "~/bridge/item-detail/useItemDetailTabs";

const sources = {
	kind: "available",
	itemId: "runtime:target",
	targetTitle: "Target",
	source: [
		{
			ownerItemId: "runtime:source",
			ownerDefinitionItemId: "source",
			title: "Source",
			sourceUrl: "resource:source",
			compositeUrl: "resource:source-composite",
			space: 1,
			line: [
				{
					lineId: "line:source",
					title: "Produce target",
					output: [
						{
							kind: "weight",
							optionWeight: 2,
							quantity: {
								min: 1,
								max: 2,
							},
							selections: {
								min: 1,
								max: 1,
							},
							setWeight: 3,
							totalOptionWeight: 4,
							totalSetWeight: 5,
						},
					],
				},
			],
		},
	],
} as const satisfies useItemDetailSources.Projection;

const definition = {
	kind: "available",
	itemId: "target",
	title: "Target",
	sourceUrl: "resource:target",
	compositeUrl: "resource:target-composite",
	description: "A target item.",
	itemType: "simple",
	storageScope: "any",
	maxStackSize: 10,
	ownedQuantity: 2,
	maxCount: 5,
	totalCharges: 3,
} as const satisfies useItemDefinitionDetail.Projection;

const identity = {
	kind: "available",
	definitionId: "target",
	itemId: "runtime:target",
	title: "Target",
	sourceUrl: "resource:target",
	compositeUrl: "resource:target-composite",
} as const satisfies useItemDetailIdentity.Projection;

const queue = {
	kind: "available",
	itemId: "runtime:producer",
	capacity: 3,
	active: [
		{
			jobId: "job:active",
			lineId: "line:produce",
			title: "Produce",
			status: "running",
			durationMs: 1_000,
			remainingMs: 600,
		},
	],
	request: [
		{
			requestId: "request:1",
			lineId: "line:produce",
			title: "Produce",
			status: "waiting-inputs",
		},
	],
} as const satisfies useItemDetailQueue.Projection;

const tabs = [
	"lines",
	"sources",
	"info",
] as const satisfies readonly useItemDetailTabs.Tab[];

describe("Item Detail projection structural equality", () => {
	it.each([
		[
			"sources",
			sources,
			structuredClone(sources),
		],
		[
			"definition",
			definition,
			structuredClone(definition),
		],
		[
			"identity",
			identity,
			structuredClone(identity),
		],
		[
			"queue",
			queue,
			structuredClone(queue),
		],
		[
			"tabs",
			tabs,
			[
				...tabs,
			],
		],
	])("keeps a structurally equal %s projection stable", (_name, previous, next) => {
		expect(Equal.equals(previous, next)).toBe(true);
	});

	it.each([
		[
			"source identity",
			sources,
			{
				...sources,
				source: [
					{
						...sources.source[0],
						ownerItemId: "runtime:other-source",
					},
				],
			},
		],
		[
			"source asset",
			sources,
			{
				...sources,
				source: [
					{
						...sources.source[0],
						sourceUrl: "resource:other-source",
					},
				],
			},
		],
		[
			"source line",
			sources,
			{
				...sources,
				source: [
					{
						...sources.source[0],
						line: [
							{
								...sources.source[0].line[0],
								title: "Other line",
							},
						],
					},
				],
			},
		],
		[
			"source output quantity",
			sources,
			{
				...sources,
				source: [
					{
						...sources.source[0],
						line: [
							{
								...sources.source[0].line[0],
								output: [
									{
										...sources.source[0].line[0].output[0],
										quantity: {
											min: 1,
											max: 3,
										},
									},
								],
							},
						],
					},
				],
			},
		],
		[
			"source output probability",
			sources,
			{
				...sources,
				source: [
					{
						...sources.source[0],
						line: [
							{
								...sources.source[0].line[0],
								output: [
									{
										...sources.source[0].line[0].output[0],
										optionWeight: 3,
									},
								],
							},
						],
					},
				],
			},
		],
		[
			"definition authored fact",
			definition,
			{
				...definition,
				description: "Changed.",
			},
		],
		[
			"definition runtime quantity",
			definition,
			{
				...definition,
				ownedQuantity: 3,
			},
		],
		[
			"identity title",
			identity,
			{
				...identity,
				title: "Other target",
			},
		],
		[
			"identity asset",
			identity,
			{
				...identity,
				compositeUrl: "resource:other-composite",
			},
		],
		[
			"queue active job",
			queue,
			{
				...queue,
				active: [
					{
						...queue.active[0],
						status: "paused",
					},
				],
			},
		],
		[
			"queue request",
			queue,
			{
				...queue,
				request: [
					{
						...queue.request[0],
						requestId: "request:2",
					},
				],
			},
		],
		[
			"tabs order",
			tabs,
			[
				"sources",
				"lines",
				"info",
			],
		],
	])("detects a rendered %s change", (_name, previous, next) => {
		expect(Equal.equals(previous, next)).toBe(false);
	});
});
