// @vitest-environment jsdom

import { act } from "react";
import { describe, expect, it } from "vitest";

import { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";

import {
	currentRuntime,
	openItemDetail,
	publishRuntime,
	renderItemDetail,
} from "./ItemDetailModal.test/fixture";
describe("ItemDetailModal / queue state", () => {
	it("shows a non-zero Queue badge and queued idle line state from live requests", async () => {
		const { readControl } = await renderItemDetail();
		const owner = currentRuntime.items.find((item) => item.item.id === "workshop");
		if (owner === undefined) throw new Error("Missing Workshop runtime item.");

		await act(async () => {
			openItemDetail(readControl(), {
				itemId: owner.id,
			});
			await Promise.resolve();
			await Promise.resolve();
		});
		expect(document.querySelector('[data-ui="ItemDetailQueueTabCount"]')).toBeNull();

		await act(async () => {
			publishRuntime(
				RuntimeSchema.parse({
					...currentRuntime,
					jobQueue: [
						{
							id: "request:workshop:1",
							ownerItemId: owner.id,
							lineId: "line:workshop:water",
						},
						{
							id: "request:workshop:2",
							ownerItemId: owner.id,
							lineId: "line:workshop:water",
						},
					],
				}),
			);
			await Promise.resolve();
		});

		const queueTabBadge = document.querySelector<HTMLElement>(
			'[data-ui="ItemDetailQueueTabCount"]',
		);
		expect(queueTabBadge?.textContent).toBe("2");
		const line = document.querySelector<HTMLElement>('[data-ui="TileLine"]');
		expect(line?.dataset.active).toBe("false");
		expect(line?.dataset.queued).toBe("true");
		expect(line?.querySelector('[data-ui="TileLineQueuedBadge"]')).toBeNull();
		expect(line?.querySelector('[data-ui="TileLineQueuedMessage"]')?.textContent).toContain(
			"Queued for automatic start",
		);

		await act(async () => {
			publishRuntime(
				RuntimeSchema.parse({
					...currentRuntime,
					jobQueue: [],
				}),
			);
			await Promise.resolve();
		});
		expect(document.querySelector('[data-ui="ItemDetailQueueTabCount"]')).toBeNull();
		expect(document.querySelector<HTMLElement>('[data-ui="TileLine"]')?.dataset.queued).toBe(
			"false",
		);
	});
	it("keeps an occupied single-slot line labeled Start and disables it", async () => {
		const { readControl } = await renderItemDetail();
		const owner = currentRuntime.items.find((item) => item.item.id === "workshop");
		if (owner === undefined || owner.item.type !== "producer")
			throw new Error("Missing Workshop producer runtime item.");

		await act(async () => {
			publishRuntime(
				RuntimeSchema.parse({
					...currentRuntime,
					items: currentRuntime.items.map((item) =>
						item.id === owner.id && item.item.type === "producer"
							? {
									...item,
									item: {
										...item.item,
										maxQueueSize: 1,
									},
								}
							: item,
					),
					jobs: [
						{
							id: "job:workshop",
							ownerItemId: owner.id,
							lineId: "line:workshop:water",
							durationMs: 1_000,
							remainingMs: 400,
						},
					],
				}),
			);
			openItemDetail(readControl(), {
				itemId: owner.id,
			});
			await Promise.resolve();
			await Promise.resolve();
		});

		const enqueueButton = document.querySelector<HTMLButtonElement>(
			'[data-ui="TileLineEnqueueButton"]',
		);
		expect(enqueueButton?.textContent).toBe("Enqueue");
		expect(enqueueButton?.disabled).toBe(true);
		const queueTab = document.querySelector<HTMLButtonElement>('[data-tab="queue"]');
		if (queueTab === null) throw new Error("Missing single-slot Queue tab.");
		await act(async () => {
			queueTab.click();
			await Promise.resolve();
		});
		const activeRow = document.querySelector<HTMLElement>(
			'[data-ui="ItemQueueRow"][data-state="active"]',
		);
		expect(activeRow?.textContent).toContain("Water");
		expect(activeRow?.textContent).not.toContain("Running");
		expect(
			activeRow?.querySelector<HTMLImageElement>('[data-ui="ItemQueueWorkIdentity"] img')
				?.src,
		).toContain("resource:asset:water");
		expect(
			activeRow?.querySelector<HTMLElement>('[data-ui="ItemQueueProgressFill"]')?.style.width,
		).toBe("60%");
		expect(activeRow?.querySelector('[data-ui="ItemQueueRuntimeValue"]')?.textContent).toBe(
			"0.4 s",
		);
		expect(activeRow?.querySelector('[data-ui="ItemQueueRuntimeDetail"]')?.textContent).toBe(
			"Remaining of 1 s",
		);
		expect(document.querySelector('[data-ui="ItemQueueRow"][data-state="queued"]')).toBeNull();
		const activeSlot = document.querySelector('[data-ui="ItemQueueActiveSlot"]');

		await act(async () => {
			publishRuntime(
				RuntimeSchema.parse({
					...currentRuntime,
					items: currentRuntime.items.map((item) =>
						item.id === owner.id && item.item.type === "producer"
							? {
									...item,
									item: {
										...item.item,
										maxQueueSize: 2,
									},
								}
							: item,
					),
					jobQueue: [
						{
							id: "request:workshop",
							ownerItemId: owner.id,
							lineId: "line:workshop:water",
						},
					],
				}),
			);
			await Promise.resolve();
		});
		const queuedRow = document.querySelector<HTMLElement>(
			'[data-ui="ItemQueueRow"][data-state="queued"]',
		);
		expect(queuedRow?.textContent).toContain("Water");
		expect(queuedRow?.textContent).toContain("Queued #1");
		expect(
			queuedRow?.querySelector<HTMLImageElement>('[data-ui="ItemQueueWorkIdentity"] img')
				?.src,
		).toContain("resource:asset:water");
		expect(queuedRow?.querySelector("button")).toBeNull();
		const clearQueueButton = document.querySelector<HTMLButtonElement>(
			'[data-ui="ItemQueueClearButton"]',
		);
		expect(clearQueueButton).not.toBeNull();
		expect(document.querySelectorAll('[data-ui="ItemQueueClearButton"]')).toHaveLength(1);
		expect(document.querySelector('[data-ui="ItemQueueEmptyState"]')).toBeNull();

		await act(async () => {
			publishRuntime(
				RuntimeSchema.parse({
					...currentRuntime,
					jobQueue: [],
					jobs: [],
				}),
			);
			await Promise.resolve();
		});
		expect(document.querySelector('[data-ui="ItemQueueActiveSlot"]')).toBe(activeSlot);
		expect(document.querySelector('[data-ui="ItemQueueIdleSlot"]')?.textContent).toContain(
			"No active job",
		);
		expect(document.querySelector('[data-ui="ItemQueueIdleSlot"]')?.textContent).toContain(
			"Nothing is currently scheduled to run.",
		);
		const emptyQueue = document.querySelector('[data-ui="ItemQueueEmptyState"]');
		expect(emptyQueue?.textContent).toContain("Queue is empty");
		expect(document.querySelector('[data-ui="ItemQueueRow"]')).toBeNull();
		expect(document.querySelector('[data-ui="ItemQueueClearButton"]')).toBeNull();
	});
});
