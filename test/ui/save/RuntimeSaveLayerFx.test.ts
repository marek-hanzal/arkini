import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { removeItemFx } from "~/v1/runtime/write/removeItemFx";
import { spawnItemFx } from "~/v1/runtime/write/spawnItemFx";
import type { StateSchema } from "~/v1/state/schema/StateSchema";
import { createGameSession } from "~/v1/ui/session/createGameSession";
import { createJobTestConfig } from "~test/job/support/jobTestConfig";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe("RuntimeSaveLayerFx", () => {
	it("debounces committed snapshots and ignores failed mutations", async () => {
		const saves: StateSchema.Type[] = [];
		const session = await createGameSession({
			config: createJobTestConfig(),
			tickIntervalMs: 60_000,
			save: {
				debounceMs: 15,
				write: (state) =>
					Effect.sync(() => {
						saves.push(state);
					}),
			},
		});

		try {
			const first = await session.run(
				spawnItemFx({
					id: "runtime:save:first",
					itemId: "water",
					location: {
						scope: "inventory",
						position: {
							x: 0,
							y: 0,
						},
					},
					quantity: 1,
				}),
			);
			await session.run(
				spawnItemFx({
					id: "runtime:save:second",
					itemId: "water",
					location: {
						scope: "inventory",
						position: {
							x: 1,
							y: 0,
						},
					},
					quantity: 1,
				}),
			);

			await sleep(50);
			expect(saves).toHaveLength(1);
			expect(saves[0]?.items).toHaveLength(2);

			await expect(
				session.run(
					removeItemFx({
						itemId: first.id,
						revision: "revision:stale",
					}),
				),
			).rejects.toBeDefined();
			await sleep(30);
			expect(saves).toHaveLength(1);
		} finally {
			await session.dispose();
		}
	});

	it("flushes the latest committed runtime when the session is disposed", async () => {
		const saves: StateSchema.Type[] = [];
		const session = await createGameSession({
			config: createJobTestConfig(),
			tickIntervalMs: 60_000,
			save: {
				debounceMs: 60_000,
				write: (state) =>
					Effect.sync(() => {
						saves.push(state);
					}),
			},
		});

		await session.run(
			spawnItemFx({
				id: "runtime:save:dispose",
				itemId: "water",
				location: {
					scope: "inventory",
					position: {
						x: 0,
						y: 0,
					},
				},
				quantity: 1,
			}),
		);
		await session.dispose();

		expect(saves).toHaveLength(1);
		expect(saves[0]?.items).toHaveLength(1);
	});
});
