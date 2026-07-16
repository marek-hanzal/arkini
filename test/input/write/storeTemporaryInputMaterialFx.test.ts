import { describe, expect, it } from "vitest";

import { storeInputMaterialFx } from "~/engine/input/write/storeInputMaterialFx";
import { readRuntimeFx } from "~/engine/runtime/read/readRuntimeFx";
import { spawnItemFx } from "~/engine/runtime/write/spawnItemFx";
import { GameConfigSchema } from "~/engine/schema/GameConfigSchema";
import { createGameSession } from "~/ui/session/createGameSession";

const baseItem = (id: string) => ({
	id,
	title: id,
	description: id,
	asset: {
		source: [
			`asset:${id}`,
		],
	},
	tags: [],
	categoryId: "resource",
	scope: "board" as const,
	maxStackSize: 1,
});

const config = GameConfigSchema.parse({
	version: "1.0",
	resources: {
		hero: "hero",
	},
	meta: {
		id: "game:temporary-material",
		title: "Temporary material",
		board: {
			width: 2,
			height: 1,
		},
		inventory: {
			width: 1,
			height: 1,
		},
	},
	start: {
		currentSpace: 0,
	},
	categories: {},
	items: {
		owner: {
			...baseItem("owner"),
			type: "producer",
			lines: [
				{
					id: "line:owner",
					title: "line:owner",
					description: "line:owner",
					runtimeMs: 1_000,
					input: [
						{
							type: "materials",
							selector: {
								type: "item",
								itemId: "temporary",
							},
							quantity: {
								type: "value",
								value: 1,
							},
							capacity: 0,
							mode: "consume",
						},
					],
					rules: [],
				},
			],
		},
		temporary: {
			...baseItem("temporary"),
			type: "temporary",
			durationMs: 600,
		},
	},
});

describe("temporary material input eligibility", () => {
	it("rejects the source before mutation and publishes no event", async () => {
		const session = await createGameSession({
			config,
			tickIntervalMs: 60_000,
		});
		const batches: unknown[] = [];
		try {
			await session.run(
				spawnItemFx({
					id: "runtime:owner",
					itemId: "owner",
					location: {
						scope: "board",
						space: 0,
						position: {
							x: 0,
							y: 0,
						},
					},
					quantity: 1,
				}),
			);
			const temporary = await session.run(
				spawnItemFx({
					id: "runtime:temporary",
					itemId: "temporary",
					location: {
						scope: "board",
						space: 0,
						position: {
							x: 1,
							y: 0,
						},
					},
					quantity: 1,
				}),
			);
			const before = await session.run(readRuntimeFx());
			const unsubscribe = session.subscribeEvents((batch) => {
				batches.push(batch);
			});
			try {
				await expect(
					session.run(
						storeInputMaterialFx({
							ownerItemId: "runtime:owner",
							lineId: "line:owner",
							inputIndex: 0,
							sourceItemId: temporary.id,
							sourceItemRevision: temporary.revision,
							quantity: 1,
						}),
					),
				).rejects.toMatchObject({
					_tag: "InputMaterialUnavailableError",
					sourceItemId: temporary.id,
				});
				const after = await session.run(readRuntimeFx());
				expect(after).toEqual(before);
				expect(batches).toEqual([]);
			} finally {
				unsubscribe();
			}
		} finally {
			await session.dispose();
		}
	});
});
