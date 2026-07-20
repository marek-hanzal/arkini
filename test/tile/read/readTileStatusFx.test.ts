import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { readTileCapabilities } from "~/engine/tile/read/readTileCapabilities";
import { readTileStatusFx } from "~/engine/tile/read/readTileStatusFx";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";
import { lineRunRuntime, lineRunTestConfig } from "~test/line/fx/run/support/lineRunTestRuntime";

const ownerId = "runtime:workshop";
const lineId = "line:workshop:build";

const activeJob = {
	id: "job:workshop",
	ownerItemId: ownerId,
	lineId,
	durationMs: 1_000,
	remainingMs: 500,
} as const;

const readStatus = (runtime: RuntimeSchema.Type) =>
	Effect.runSync(
		readTileStatusFx({
			itemId: ownerId,
			runtime,
		}),
	);

describe("readTileStatusFx", () => {
	it("adds Status only for canonical line owners", () => {
		const runtime = lineRunRuntime({});
		expect(readTileCapabilities(runtime.items[0])).toEqual([
			"info",
			"status",
		]);
		expect(
			readTileCapabilities({
				...runtime.items[0],
				item: lineRunTestConfig.items.water,
			}),
		).toEqual([
			"info",
		]);
	});

	it("classifies ready, working, stored, and paused owner states", () => {
		const ready = lineRunRuntime({
			permit: true,
		});
		expect(readStatus(ready)).toMatchObject({
			kind: "available",
			state: {
				kind: "ready",
			},
		});

		const working = {
			...ready,
			jobs: [
				activeJob,
			],
		} satisfies RuntimeSchema.Type;
		expect(readStatus(working)).toMatchObject({
			kind: "available",
			state: {
				kind: "working",
			},
		});

		const dependencyPaused = {
			...working,
			items: working.items.filter((item) => item.item.id !== "permit"),
		} satisfies RuntimeSchema.Type;
		expect(readStatus(dependencyPaused)).toMatchObject({
			kind: "available",
			state: {
				kind: "paused",
				reason: {
					kind: "dependencies",
				},
			},
		});

		const owner = working.items.find((item) => item.id === ownerId);
		if (owner === undefined) throw new Error("Missing line owner.");
		const storagePaused = {
			...working,
			items: working.items.map((item) =>
				item.id === ownerId
					? {
							...item,
							location: {
								scope: "toolbar" as const,
								position: {
									x: 0,
									y: 0,
								},
							},
						}
					: item,
			),
		} satisfies RuntimeSchema.Type;
		expect(readStatus(storagePaused)).toMatchObject({
			kind: "available",
			state: {
				kind: "paused",
				reason: {
					kind: "passive-storage",
					location: "toolbar",
				},
			},
		});

		const stored = {
			...storagePaused,
			jobs: [],
		} satisfies RuntimeSchema.Type;
		expect(readStatus(stored)).toMatchObject({
			kind: "available",
			state: {
				kind: "stored",
				location: "toolbar",
			},
		});
	});

	it("returns unavailable for stale or unsupported identities", () => {
		const runtime = lineRunRuntime({});
		expect(
			Effect.runSync(
				readTileStatusFx({
					itemId: "runtime:missing",
					runtime,
				}),
			),
		).toEqual({
			kind: "unavailable",
		});
		const simple = runtime.items.find((item) => item.item.id === "water");
		if (simple !== undefined) {
			expect(
				Effect.runSync(
					readTileStatusFx({
						itemId: simple.id,
						runtime,
					}),
				),
			).toEqual({
				kind: "unavailable",
			});
		}
	});
});
