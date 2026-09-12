import { CommonSchema } from "~/item-definition/schema/CommonSchema";
import { readItemDetailQueueFx } from "~/item-detail-read/fx/readItemDetailQueueFx";
import {
	Effect,
	GameConfigFx,
	describe,
	expect,
	it,
	lineRunRuntime,
	lineRunTestConfig,
	readLines,
} from "../support/readItemDetailLinesFxFixture";

const readControlledOwner = (control: CommonSchema.Type["control"], remainingDurationMs = 300) => {
	const item = CommonSchema.parse({
		...lineRunTestConfig.items.workshop,
		type: "common",
		scope: "board",
		maxStackSize: 1,
		clock: {
			intervalMs: 100,
			durationMs: 300,
		},
		control,
	});
	const base = lineRunRuntime({
		permit: true,
		water: [
			3,
		],
	});
	const runtime = {
		...base,
		items: base.items.map((owner) =>
			owner.id === "runtime:workshop"
				? {
						...owner,
						item,
						schedule: {
							remainingIntervalMs: 100,
							remainingDurationMs,
						},
					}
				: owner,
		),
	};
	const config = {
		...lineRunTestConfig,
		items: {
			...lineRunTestConfig.items,
			workshop: item,
		},
	};
	return {
		lines: readLines(runtime, "runtime:workshop", config),
		queue: Effect.runSync(
			readItemDetailQueueFx({
				itemId: "runtime:workshop",
				runtime,
			}).pipe(Effect.provideService(GameConfigFx, config)),
		),
	};
};

describe("Item Detail production control", () => {
	it("keeps automatic production inspectable while its manual actions remain closed", () => {
		const automatic = readControlledOwner("automatic-only");
		expect(automatic.lines).toMatchObject({
			kind: "available",
			line: [
				{
					clock: {
						selected: false,
						canChange: false,
					},
					availability: {
						kind: "available",
					},
					actions: {
						canChangeDefault: false,
						canWithdraw: false,
						enqueue: {
							enabled: false,
						},
					},
					input: [
						{
							storedQuantity: 3,
							canWithdraw: false,
						},
					],
				},
			],
		});
		expect(automatic.queue).toMatchObject({
			kind: "available",
			canClearQueue: false,
		});

		const interactive = readControlledOwner("interactive");
		expect(interactive.lines).toMatchObject({
			line: [
				{
					clock: {
						selected: false,
						canChange: true,
					},
					actions: {
						canChangeDefault: true,
						canWithdraw: true,
						enqueue: {
							enabled: true,
						},
					},
					input: [
						{
							canWithdraw: true,
						},
					],
				},
			],
		});
		expect(interactive.queue).toMatchObject({
			canClearQueue: true,
		});

		const draining = readControlledOwner("interactive", 0);
		expect(draining.lines).toMatchObject({
			line: [
				{
					clock: {
						selected: false,
						canChange: false,
					},
					actions: {
						canChangeDefault: true,
						canWithdraw: true,
						enqueue: {
							enabled: false,
						},
					},
				},
			],
		});
	});
});
