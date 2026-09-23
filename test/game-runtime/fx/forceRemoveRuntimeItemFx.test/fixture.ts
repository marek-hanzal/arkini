import { GameConfigSchema } from "~/game-config/schema/GameConfigSchema";
import type { RuntimeItemSchema } from "~/game-runtime/schema/RuntimeItemSchema";
import type { RuntimeSchema } from "~/game-runtime/schema/RuntimeSchema";
import { createJobTestConfig } from "~test/production-job/support/jobTestConfig";

export const boardFn = (x: number) => ({
	scope: "board" as const,
	space: 0,
	position: {
		x,
		y: 0,
	},
});
export const fixtureFn = (width = 2) => {
	const base = createJobTestConfig();
	const config = GameConfigSchema.parse({
		...base,
		meta: {
			...base.meta,
			board: {
				width,
				height: 1,
			},
		},
		items: {
			...base.items,
			forge: {
				...base.items.forge,
				lines: [
					base.items.forge.lines[0],
					{
						...base.items.forge.lines[0],
						id: "line:forge:stored-holder",
						title: "Stored holder",
						input: [
							{
								type: "materials",
								query: {
									distance: "far" as const,
									selector: {
										type: "item",
										itemUid: "holder",
									},
								},
								quantity: {
									min: 1,
									max: 1,
								},
								mode: "consume",
							},
						],
					},
					{
						...base.items.forge.lines[0],
						id: "line:forge:stored-water",
						title: "Stored water",
						input: [
							{
								type: "materials",
								query: {
									distance: "far" as const,
									selector: {
										type: "item",
										itemUid: "water",
									},
								},
								quantity: {
									min: 1,
									max: 5,
								},
								mode: "consume",
							},
						],
					},
				],
			},
			tool: {
				...base.items.tool,

				units: {
					amount: 2,
				},
			},
			water: {
				...base.items.water,
			},
			holder: {
				...base.items.forge,
				uid: "holder",
				lines: base.items.forge.lines,
			},
		},
	});
	const itemFn = (
		id: string,
		itemId: string,
		location: RuntimeItemSchema.Type["location"],
	): RuntimeItemSchema.Type => ({
		id,
		item: config.items[itemId],
		location,
		revision: `revision:${id}`,
	});
	const owner = itemFn("owner", "forge", boardFn(0));
	const inputFn = (
		ownerItemId: string,
		inputIndex: number,
		lineId = "line:forge:stored-holder",
	) => ({
		scope: "input" as const,
		ownerItemId,
		lineId,
		inputIndex,
	});
	const reserve = {
		...itemFn("reserve", "tool", {
			scope: "reserved",
			jobId: "job",
			inputIndex: 1,
		}),
		remainingUnits: 1,
	};
	const buffer = itemFn("buffer", "holder", inputFn(owner.id, 0));
	const child = itemFn("child", "water", inputFn(buffer.id, 0, "line:forge:run"));
	const consumed = itemFn("consumed", "water", {
		scope: "job",
		jobId: "job",
		inputIndex: 0,
	});
	const blocker = itemFn("blocker", "water", boardFn(1));
	const runtime: RuntimeSchema.Type = {
		cheats: {
			enabled: false,
			everEnabled: false,
			speedUpGameplay: false,
		},
		currentSpace: 0,
		templateUidBySpace: {},
		items: [
			owner,
			blocker,
			buffer,
			child,
			consumed,
			reserve,
		],
		jobs: [
			{
				id: "job",
				ownerItemId: owner.id,
				lineId: "line:forge:run",
				durationMs: 1000,
				remainingMs: 500,
			},
		],
		jobQueue: [
			{
				id: "queued",
				ownerItemId: owner.id,
				lineId: "line:forge:run",
			},
		],
		defaultLineByOwnerItemId: {
			[owner.id]: "line:forge:run",
			[buffer.id]: "line:forge:run",
		},
	};
	return {
		config,
		runtime,
		owner,
		reserve,
		buffer,
		child,
		itemFn,
		inputFn,
	};
};
