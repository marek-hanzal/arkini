import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { modifyRuntimeFx } from "~/v1/runtime/internal/modifyRuntimeFx";
import { spawnItemFx } from "~/v1/runtime/write/spawnItemFx";
import { createGameSession } from "~/v1/ui/session/createGameSession";
import { createJobTestConfig } from "~test/job/support/jobTestConfig";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe("GameEventsFx", () => {
	it("does not publish events for a candidate runtime that fails validation", async () => {
		const session = await createGameSession({
			config: createJobTestConfig(),
			tickIntervalMs: 60_000,
		});
		const batches: unknown[] = [];
		const unsubscribe = session.subscribeEvents((batch) => batches.push(batch));

		try {
			await session.run(
				spawnItemFx({
					id: "runtime:event:duplicate",
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
			await expect(
				session.run(
					modifyRuntimeFx((runtime) =>
						Effect.succeed([
							runtime,
							{
								...runtime,
								items: [
									...runtime.items,
									...runtime.items,
								],
							},
							[
								{
									type: "job:completed",
									jobId: "job:fake",
									ownerItemId: "owner:fake",
									lineId: "line:fake",
								},
							],
						] as const),
					),
				),
			).rejects.toBeDefined();
			await sleep(20);
			expect(batches).toEqual([]);
		} finally {
			unsubscribe();
			await session.dispose();
		}
	});
});
