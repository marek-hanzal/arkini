import { Effect } from "effect";
import { expect, it } from "vitest";
import { applyBoardTemplateRuntimeFx } from "~/board-template/fx/applyBoardTemplateRuntimeFx";
import { GameConfigSchema } from "~/game-config/schema/GameConfigSchema";
import { assertRuntimeFx } from "~/game-runtime/fx/assertRuntimeFx";
import { readRuntimeFx } from "~/game-runtime/fx/readRuntimeFx";
import { mergeItemsFx } from "~/item-merge/fx/mergeItemsFx";
import { autofillLineInputFx } from "~/production-input/fx/autofillLineInputFx";
import { inputRuntimeTestConfig } from "~test/production-input/support/inputRuntimeTestConfig";
import { spawnItemFx } from "~test/support/spawnItemFx";
import { useGameFx } from "~test/support/useGameFx";

it("returns locally admitted deliveries after their transported owner is erased in another space", () => {
	const config = GameConfigSchema.parse({
		...inputRuntimeTestConfig,
		templates: [
			{
				uid: "empty",
				title: "Empty",
				width: 2,
				height: 1,
				board: [],
			},
		],
		items: {
			...inputRuntimeTestConfig.items,
			portal: {
				...inputRuntimeTestConfig.items.stone,
				uid: "portal",
				merge: [
					{
						action: "space",
						space: 7,
						effect: "keep",
					},
				],
			},
		},
	});
	const result = Effect.runSync(
		Effect.gen(function* () {
			for (const [id, itemId, x, space] of [
				[
					"owner",
					"workshop",
					0,
					0,
				],
				[
					"water1",
					"water",
					1,
					0,
				],
				[
					"water2",
					"water",
					2,
					0,
				],
				[
					"water3",
					"water",
					3,
					0,
				],
				[
					"portal",
					"portal",
					4,
					0,
				],
				[
					"unrelated",
					"stone",
					0,
					9,
				],
			] as const)
				yield* spawnItemFx({
					id,
					itemUid: itemId,
					location: {
						scope: "board",
						space,
						position: {
							x,
							y: 0,
						},
					},
				});
			yield* autofillLineInputFx({
				ownerItemId: "owner",
				lineUid: "line:workshop:build",
				inputIndex: 0,
			});
			const admitted = yield* readRuntimeFx();
			const owner = admitted.items.find(({ id }) => id === "owner")!;
			const portal = admitted.items.find(({ id }) => id === "portal")!;
			yield* mergeItemsFx({
				sourceItemId: owner.id,
				sourceRevision: owner.revision,
				targetItemId: portal.id,
				targetRevision: portal.revision,
			});
			const transported = yield* readRuntimeFx();
			yield* assertRuntimeFx({
				runtime: transported,
			});
			const transition = yield* applyBoardTemplateRuntimeFx({
				runtime: transported,
				space: 7,
				templateUid: "empty",
			});
			yield* assertRuntimeFx({
				runtime: transition.runtime,
			});
			return {
				admitted,
				transported,
				after: transition.runtime,
			};
		}).pipe(
			useGameFx({
				config,
			}),
		),
	);
	const admitted = result.admitted.items.filter((item) => item.location.scope === "delivery");
	expect(admitted).toHaveLength(3);
	expect(result.transported.items.find(({ id }) => id === "owner")).toMatchObject({
		location: {
			scope: "board",
			space: 7,
		},
	});
	for (const material of admitted) {
		expect(result.transported.items.find(({ id }) => id === material.id)).toMatchObject({
			location: {
				scope: "delivery",
				phase: "outbound",
				origin: {
					space: 0,
				},
				target: {
					ownerItemId: "owner",
				},
			},
		});
		expect(result.after.items.find(({ id }) => id === material.id)).toMatchObject({
			item: material.item,
			location: {
				scope: "delivery",
				phase: "returning",
				origin: {
					space: 0,
				},
				returnFrom: {
					space: 7,
				},
			},
		});
	}
	expect(result.after.items.some(({ id }) => id === "owner")).toBe(false);
	for (const id of [
		"portal",
		"unrelated",
	])
		expect(result.after.items.find((item) => item.id === id)).toEqual(
			result.transported.items.find((item) => item.id === id),
		);
});
