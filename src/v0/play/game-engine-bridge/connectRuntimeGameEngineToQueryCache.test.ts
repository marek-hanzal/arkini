import { QueryClient } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";
import { boardQueryKeys } from "~/v0/board/query/boardQueryKeys";
import type { BoardView } from "~/v0/board/view/BoardViewSchema";
import { RuntimeGameEngineAdapter } from "~/v0/game/engine/runtime/RuntimeGameEngineAdapter";
import { createEngineTestConfig } from "~/v0/game/engine/test/createEngineTestConfig";
import { TestRandomService } from "~/v0/game/engine/test/TestRandomService";
import { inventoryQueryKeys } from "~/v0/inventory/query/inventoryQueryKeys";
import type { InventoryView } from "~/v0/inventory/view/InventoryViewSchema";
import { connectRuntimeGameEngineToQueryCache } from "~/v0/play/game-engine-bridge/connectRuntimeGameEngineToQueryCache";

const createQueryClient = () =>
	new QueryClient({
		defaultOptions: {
			queries: {
				retry: false,
			},
		},
	});

const readBoard = (queryClient: QueryClient) =>
	queryClient.getQueryData<BoardView>(boardQueryKeys.view);

const readInventory = (queryClient: QueryClient) =>
	queryClient.getQueryData<InventoryView>(inventoryQueryKeys.view);

describe("connectRuntimeGameEngineToQueryCache", () => {
	afterEach(() => {
		vi.useRealTimers();
	});
	it("primes board and inventory caches from the runtime snapshot", async () => {
		const adapter = await RuntimeGameEngineAdapter.create({
			config: createEngineTestConfig(),
			nowMs: 100,
			random: TestRandomService,
		});
		const queryClient = createQueryClient();

		const unsubscribe = connectRuntimeGameEngineToQueryCache({
			adapter,
			nowMs: 100,
			queryClient,
		});

		expect(readBoard(queryClient)?.byId["item-instance:1"]).toMatchObject({
			activation: {
				kind: "producer",
				trigger: "click",
			},
			itemId: "item:producer",
			x: 0,
			y: 0,
		});
		expect(readInventory(queryClient)?.slots).toHaveLength(2);
		expect(readInventory(queryClient)?.firstEmptySlotIndex).toBe(0);

		unsubscribe();
	});

	it("applies runtime result visual events to the existing query cache", async () => {
		vi.useFakeTimers();
		const adapter = await RuntimeGameEngineAdapter.create({
			config: createEngineTestConfig(),
			nowMs: 0,
			random: TestRandomService,
		});
		const queryClient = createQueryClient();
		const unsubscribe = connectRuntimeGameEngineToQueryCache({
			adapter,
			nowMs: 0,
			queryClient,
		});

		await adapter.dispatch({
			action: {
				inputRefs: [],
				producerItemInstanceId: "item-instance:1",
				productId: "product:test",
				type: "producer.product.start",
			},
			nowMs: 0,
		});
		await adapter.tick({
			nowMs: 1_000,
		});
		await vi.runAllTimersAsync();

		const board = readBoard(queryClient);
		const inventory = readInventory(queryClient);
		expect(board?.byCellKey["1:0"]).toMatchObject({
			itemId: "item:twig",
		});
		expect(inventory?.bySlotIndex["0"]?.stack).toMatchObject({
			itemId: "item:twig",
			quantity: 1,
		});

		unsubscribe();
	});
});
