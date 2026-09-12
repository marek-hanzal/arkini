import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { GameConfigFx } from "~/game-config/context/GameConfigFx";
import { ClockSchema } from "~/item-definition/schema/ClockSchema";
import { readItemDetailScheduleFx } from "~/item-detail-read/fx/readItemDetailScheduleFx";
import {
	lineRunRuntime,
	lineRunTestConfig,
} from "~test/production-line/support/lineRunTestRuntime";

const readSchedule = ({
	running = true,
	remainingDurationMs = 300,
	enable = true,
}: {
	readonly running?: boolean;
	readonly remainingDurationMs?: number;
	readonly enable?: boolean;
}) => {
	const item = ClockSchema.parse({
		...lineRunTestConfig.items.workshop,
		type: "clock",
		scope: "board",
		maxStackSize: 1,
		intervalMs: 100,
		durationMs: 300,
		control: "interactive",
		enable,
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
							running,
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
	it("separates a manually enabled timer from its rule gate and finished lifetime", () => {
		expect(readSchedule({})).toMatchObject({
			intervalMs: 100,
			durationMs: 300,
			runtime: {
				running: true,
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
				running: true,
				status: "paused",
			},
		});
		expect(
			readSchedule({
				running: false,
			}),
		).toMatchObject({
			runtime: {
				running: false,
				status: "paused",
			},
		});
		expect(
			readSchedule({
				remainingDurationMs: 0,
				running: false,
			}),
		).toMatchObject({
			runtime: {
				status: "draining",
			},
		});
	});
});
