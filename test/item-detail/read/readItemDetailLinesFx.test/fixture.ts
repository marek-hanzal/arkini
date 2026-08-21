import { Effect } from "effect";
import { describe, expect, it } from "vitest";
import { GameConfigFx } from "~/engine/game/context/GameConfigFx";
import { useGameFx } from "~/engine/game/fx/useGameFx";
import { GameConfigSchema } from "~/engine/schema/GameConfigSchema";
import { startFx } from "~/engine/start/write/startFx";
import { readItemDetailLinesFx } from "~/engine/item-detail/read/readItemDetailLinesFx";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";
import { lineRunRuntime, lineRunTestConfig } from "~test/line/fx/run/support/lineRunTestRuntime";
import { JobStatusEnumSchema } from "~/engine/job/schema/read/JobStatusEnumSchema";
import { readRuntimeFx } from "~/engine/runtime/read/readRuntimeFx";
import { readArkiniGameConfigSource } from "~test/schema/support/readArkiniGameConfigSource";

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
	readArkiniGameConfigSource,
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
