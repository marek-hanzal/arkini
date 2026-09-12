import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { GameConfigFx } from "~/game-config/context/GameConfigFx";
import { CommonSchema } from "~/item-definition/schema/CommonSchema";
import { readItemDetailScheduleFx } from "~/item-detail-read/fx/readItemDetailScheduleFx";
import {
	lineRunRuntime,
	lineRunTestConfig,
} from "~test/production-line/support/lineRunTestRuntime";

const readSchedule = ({
	remainingDurationMs = 300,
	enable = true,
}: {
	readonly remainingDurationMs?: number;
	readonly enable?: boolean;
}) => {
	const item = CommonSchema.parse({
		...lineRunTestConfig.items.workshop,
		type: "common",
		scope: "board",
		maxStackSize: 1,
		control: "interactive",
		clock: {
			intervalMs: 100,
			durationMs: 300,
			enable,
		},
	});
	const base = lineRunRuntime({});
	const runtime = {
		...base,
		items: base.items.map((owner) =>
			owner.id === "runtime:workshop"
				? {
						...owner,
						item,
						schedule: {
							remainingIntervalMs: 50,
							remainingDurationMs,
						},
					}
				: owner,
		),
	};
	return Effect.runSync(
		readItemDetailScheduleFx({
			itemId: "runtime:workshop",
			runtime,
		}).pipe(Effect.provideService(GameConfigFx, lineRunTestConfig)),
	);
};

describe("readItemDetailScheduleFx", () => {
	it("projects the rule gate and finished lifetime", () => {
		expect(readSchedule({})).toMatchObject({
			intervalMs: 100,
			durationMs: 300,
			runtime: {
				remainingIntervalMs: 50,
				status: "running",
			},
		});
		expect(
			readSchedule({
				enable: false,
			}),
		).toMatchObject({
			runtime: {
				status: "paused",
			},
		});
		expect(
			readSchedule({
				remainingDurationMs: 0,
			}),
		).toMatchObject({
			runtime: {
				status: "draining",
			},
		});
	});
});
