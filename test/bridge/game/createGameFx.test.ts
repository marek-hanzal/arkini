import { Effect } from "effect";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { ArkpackStorage } from "~/bridge/arkpack/ArkpackStorage";
import { readArkpackFx } from "~/bridge/arkpack/readArkpackFx";
import { createGameFx } from "~/bridge/game/createGameFx";
import type { GameSaveStorage } from "~/bridge/save/GameSaveStorage";
import type { StateSchema } from "~/engine/state/schema/StateSchema";
import {
	createTestArkpack,
	testArkpackConfig,
} from "~test/bridge/arkpack/support/createTestArkpack";

const createStorages = async () => {
	const bytes = createTestArkpack();
	const loaded = await Effect.runPromise(
		readArkpackFx({
			bytes,
			filename: "bridge.arkpack",
			source: "imported",
		}),
	);
	const record = {
		descriptor: loaded.descriptor,
		bytes: bytes.slice().buffer,
	};
	const arkpackStorage: ArkpackStorage = {
		close: () => undefined,
		list: async () => [
			record.descriptor,
		],
		read: async (packageId) => (packageId === record.descriptor.packageId ? record : undefined),
		remove: async () => undefined,
		write: async () => undefined,
	};
	let saved: StateSchema.Type | null = null;
	const saveStorage: GameSaveStorage = {
		close: () => undefined,
		read: async () => saved,
		remove: async () => {
			saved = null;
		},
		write: async ({ state }) => {
			saved = state;
		},
	};
	return {
		arkpackStorage,
		packageId: record.descriptor.packageId,
		readSaved: () => saved,
		saveStorage,
	};
};

describe("createGameFx", () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("starts one selected package, persists its state and restores it without a second start", async () => {
		const storages = await createStorages();
		const first = await Effect.runPromise(
			createGameFx({
				packageId: storages.packageId,
				arkpackStorage: storages.arkpackStorage,
				saveStorage: storages.saveStorage,
			}),
		);

		expect(first.arkpack.packageId).toBe(storages.packageId);
		expect(first.config).toEqual(testArkpackConfig);
		expect(first.getSnapshot().items).toEqual([
			expect.objectContaining({
				item: testArkpackConfig.items.water,
				location: {
					scope: "board",
					space: 0,
					position: {
						x: 1,
						y: 0,
					},
				},
			}),
		]);
		expect(first.getResourceUrl("asset:water")).toMatch(/^blob:/);
		await first.dispose();
		expect(storages.readSaved()).not.toBeNull();

		const restored = await Effect.runPromise(
			createGameFx({
				packageId: storages.packageId,
				arkpackStorage: storages.arkpackStorage,
				saveStorage: storages.saveStorage,
			}),
		);
		try {
			expect(restored.getSnapshot().items).toHaveLength(1);
			expect(restored.getSnapshot().items[0]?.item.id).toBe("water");
		} finally {
			await restored.dispose();
		}
	});

	it("disposes a partial game bootstrap and revokes created resources when resource setup fails", async () => {
		const storages = await createStorages();
		const createObjectUrl = vi
			.spyOn(URL, "createObjectURL")
			.mockReturnValueOnce("blob:created")
			.mockImplementationOnce(() => {
				throw new Error("resource setup failed");
			});
		const revokeObjectUrl = vi.spyOn(URL, "revokeObjectURL");

		await expect(
			Effect.runPromise(
				createGameFx({
					packageId: storages.packageId,
					arkpackStorage: storages.arkpackStorage,
					saveStorage: storages.saveStorage,
				}),
			),
		).rejects.toThrow("resource setup failed");

		expect(createObjectUrl).toHaveBeenCalledTimes(2);
		expect(revokeObjectUrl).toHaveBeenCalledWith("blob:created");
	});
});
