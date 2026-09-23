import { Effect } from "effect";
import { describe, expect, it } from "vitest";
import { createTestGameSession } from "~test/support/createTestGameSession";

import { storeInputMaterialFx } from "~/production-input/fx/storeInputMaterialFx";
import { readRuntimeFx } from "~/game-runtime/fx/readRuntimeFx";
import { spawnItemFx } from "~test/support/spawnItemFx";
import { GameConfigSchema } from "~/game-config/schema/GameConfigSchema";

const baseItem = (id: string) => ({
	uid: id,

	title: id,
	description: id,
	ui: "default" as const,
	artwork: {
		scale: 0.8,
		default: [
			`artwork:${id}`,
		],
	},
});

const config = GameConfigSchema.parse({
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
	},
	start: {
		currentSpace: 0,
		spaces: [],
	},
	items: {
		owner: {
			maxQueueSize: 1,

			...baseItem("owner"),

			lines: [
				{
					id: "line:owner",
					title: "line:owner",
					description: "line:owner",
					runtimeMs: 1_000,
					input: [
						{
							type: "materials",
							query: {
								distance: "far" as const,
								selector: {
									type: "item",
									itemUid: "temporary",
								},
							},
							quantity: {
								min: 1,
								max: 1,
							},
							mode: "consume",
						},
					],
					rules: [],
				},
			],
		},
		temporary: {
			...baseItem("temporary"),

			lines: [],
			maxQueueSize: 1,
			clock: {
				durationMs: 600,
			},
		},
	},
});

describe("temporary material input eligibility", () => {
	it("stores the same temporary identity with its remaining lifetime", async () => {
		const session = await createTestGameSession({
			config,
			tickIntervalMs: 60_000,
		});
		try {
			await session.runFn(
				spawnItemFx({
					id: "runtime:owner",
					itemUid: "owner",
					location: {
						scope: "board",
						space: 0,
						position: {
							x: 0,
							y: 0,
						},
					},
				}),
			);
			const temporary = await session.runFn(
				spawnItemFx({
					id: "runtime:temporary",
					itemUid: "temporary",
					location: {
						scope: "board",
						space: 0,
						position: {
							x: 1,
							y: 0,
						},
					},
				}),
			);
			await session.runFn(
				storeInputMaterialFx({
					ownerItemId: "runtime:owner",
					lineId: "line:owner",
					inputIndex: 0,
					sourceItemId: temporary.id,
					sourceItemRevision: temporary.revision,
				}),
			);
			const stored = (await session.runFn(readRuntimeFx())).items.find(
				(item) => item.id === temporary.id,
			);
			expect(stored).toMatchObject({
				id: temporary.id,
				location: {
					scope: "input",
					ownerItemId: "runtime:owner",
					lineId: "line:owner",
					inputIndex: 0,
				},
				schedule: {
					remainingDurationMs: 600,
				},
			});
		} finally {
			await Effect.runPromise(session.disposeFx);
		}
	});
});
