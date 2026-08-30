import { Effect } from "effect";
import { describe, expect, it } from "vitest";
import { GameConfigFx } from "~/engine/game/context/GameConfigFx";
import { useGameFx } from "~test/support/game/useGameFx";
import { GameConfigSchema } from "~/game-config/schema/GameConfigSchema";
import { startFx } from "~/game-start/fx/startFx";
import { readItemDetailLinesFx } from "~/item-line-detail/fx/readItemDetailLinesFx";
import type { RuntimeSchema } from "~/game-runtime/schema/RuntimeSchema";
import {
	lineRunRuntime,
	lineRunTestConfig,
} from "~test/production-line/fx/run/support/lineRunTestRuntime";
import { JobStatusEnumSchema } from "~/production-job/schema/read/JobStatusEnumSchema";
import { readRuntimeFx } from "~/game-runtime/read/readRuntimeFx";

export {
	Effect,
	GameConfigFx,
	GameConfigSchema,
	JobStatusEnumSchema,
	describe,
	expect,
	it,
	lineRunRuntime,
	lineRunTestConfig,
	readItemDetailLinesFx,
	readRuntimeFx,
	startFx,
	useGameFx,
};

export type { RuntimeSchema };

export const readLines = (
	runtime: RuntimeSchema.Type,
	itemId = "runtime:workshop",
	config: GameConfigSchema.Type = lineRunTestConfig,
) =>
	Effect.runSync(
		readItemDetailLinesFx({
			itemId,
			runtime,
		}).pipe(Effect.provideService(GameConfigFx, config)),
	);

export const focusLine = (lineId: string, show = true) => ({
	id: lineId,
	title: lineId,
	description: lineId,
	show,
	enable: true,
	runtimeMs: 1_000,
	input: [
		{
			type: "simple" as const,
		},
	],
	rules: [],
});

export const focusConfig = GameConfigSchema.parse({
	...lineRunTestConfig,
	items: {
		...lineRunTestConfig.items,
		workshop: {
			...lineRunTestConfig.items.workshop,
			lines: [
				focusLine("line:first"),
				focusLine("line:second"),
				focusLine("line:hidden", false),
			],
		},
	},
});

export const focusRuntime = ({
	jobQueue = [],
	jobs = [],
}: {
	readonly jobQueue?: NonNullable<RuntimeSchema.Type["jobQueue"]>;
	readonly jobs?: RuntimeSchema.Type["jobs"];
}) => {
	const runtime = lineRunRuntime({});
	return {
		...runtime,
		items: runtime.items.map((item) =>
			item.id === "runtime:workshop"
				? {
						...item,
						item: focusConfig.items.workshop,
					}
				: item,
		),
		jobQueue,
		jobs,
	} satisfies RuntimeSchema.Type;
};

const depositWorkshop = lineRunTestConfig.items.workshop;
if (depositWorkshop.type !== "producer") throw new Error("Expected a producer fixture.");

export const createDepositConfig = (inputCount: number) =>
	GameConfigSchema.parse({
		...lineRunTestConfig,
		items: {
			...lineRunTestConfig.items,
			workshop: {
				...depositWorkshop,
				scope: "any",
				lines: [
					{
						...depositWorkshop.lines[0],
						id: "line:deposit",
						title: "Deposit",
						description: "Consumes nearby charges.",
						show: true,
						enable: true,
						input: Array.from(
							{
								length: inputCount,
							},
							() => ({
								charges: {
									cost: 1,
									from: "target" as const,
								},
								query: {
									distance: "close" as const,
									scope: "board" as const,
									selector: {
										itemId: "tree",
										type: "item" as const,
									},
								},
								type: "deposit" as const,
							}),
						),
						rules: [],
					},
				],
			},
			tree: {
				...lineRunTestConfig.items.water,
				uid: "tree",
				id: "tree",
				title: "Tree",
				description: "Charged deposit.",
				charges: {
					amount: 18,
				},
			},
		},
	});

export const createDepositRuntime = (
	config: GameConfigSchema.Type,
	trees: ReadonlyArray<{
		readonly id: string;
		readonly x: number;
		readonly y: number;
		readonly remainingCharges?: number;
	}>,
): RuntimeSchema.Type => ({
	cheats: {
		enabled: false,
		everEnabled: false,
		instantGameplay: false,
	},
	currentSpace: 0,
	items: [
		{
			id: "runtime:workshop",
			item: config.items.workshop!,
			location: {
				scope: "board",
				space: 0,
				position: {
					x: 1,
					y: 1,
				},
			},
			quantity: 1,
			revision: "revision:workshop",
		},
		...trees.map(({ id, remainingCharges, x, y }) => ({
			id,
			item: config.items.tree!,
			location: {
				scope: "board" as const,
				space: 0,
				position: {
					x,
					y,
				},
			},
			quantity: 1,
			...(remainingCharges === undefined
				? {}
				: {
						remainingCharges,
					}),
			revision: `revision:${id}`,
		})),
	],
	jobs: [],
	jobQueue: [],
	defaultLineByOwnerItemId: {},
});
