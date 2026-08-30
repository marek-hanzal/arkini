import type { StateSchema } from "~/game-persistence/schema/StateSchema";
import { createJobTestConfig } from "~test/production-job/support/jobTestConfig";

export const clearItemJobQueueConfig = createJobTestConfig(3);

export const clearItemJobQueueState = {
	cheats: {
		enabled: false,
		everEnabled: false,
		instantGameplay: false,
	},
	currentSpace: 0,
	items: [
		{
			id: "runtime:forge:primary",
			itemId: "forge",
			location: {
				scope: "board",
				space: 0,
				position: {
					x: 0,
					y: 0,
				},
			},
			quantity: 1,
		},
		{
			id: "runtime:forge:other",
			itemId: "forge",
			location: {
				scope: "board",
				space: 0,
				position: {
					x: 1,
					y: 0,
				},
			},
			quantity: 1,
		},
	],
	jobs: [
		{
			id: "job:active",
			ownerItemId: "runtime:forge:primary",
			lineId: "line:forge:run",
			durationMs: 1_000,
			remainingMs: 800,
		},
	],
	jobQueue: [
		{
			id: "job:queued:first",
			ownerItemId: "runtime:forge:primary",
			lineId: "line:forge:run",
		},
		{
			id: "job:queued:other:first",
			ownerItemId: "runtime:forge:other",
			lineId: "line:forge:run",
		},
		{
			id: "job:queued:second",
			ownerItemId: "runtime:forge:primary",
			lineId: "line:forge:run",
		},
		{
			id: "job:queued:other:second",
			ownerItemId: "runtime:forge:other",
			lineId: "line:forge:run",
		},
	],
} satisfies StateSchema.Type;
