// @vitest-environment jsdom

import { Effect } from "effect";
import { act } from "react";
import { describe, expect, it, vi } from "vitest";

import type { GameEngine } from "~/bridge/game/GameEngine";
import { JobStatusEnumSchema } from "~/engine/job/schema/read/JobStatusEnumSchema";
import { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";

import {
	currentRuntime,
	game,
	openItemDetail,
	publishRuntime,
	renderItemDetail,
} from "./ItemDetailModal.test/fixture";
describe("ItemDetailModal / default and active work", () => {
	it("sets and retains one save-backed default line through the canonical command boundary", async () => {
		const { readControl } = await renderItemDetail();
		const owner = currentRuntime.items.find((item) => item.item.id === "workshop");
		if (owner === undefined) throw new Error("Missing Workshop runtime item.");
		const runFx = vi
			.spyOn(game, "runFx")
			.mockImplementationOnce((() =>
				Effect.sync(() => {
					publishRuntime(
						RuntimeSchema.parse({
							...currentRuntime,
							defaultLineByOwnerItemId: {
								[owner.id]: "line:workshop:water",
							},
						}),
					);
					return {
						ownerItemId: owner.id,
						lineId: "line:workshop:water",
					};
				})) as GameEngine["runFx"])
			.mockImplementationOnce((() =>
				Effect.sync(() => {
					publishRuntime(
						RuntimeSchema.parse({
							...currentRuntime,
							defaultLineByOwnerItemId: {},
						}),
					);
					return {
						ownerItemId: owner.id,
					};
				})) as GameEngine["runFx"]);

		await act(async () => {
			openItemDetail(readControl(), {
				itemId: owner.id,
			});
			await Promise.resolve();
			await Promise.resolve();
		});
		const button = document.querySelector<HTMLButtonElement>(
			'[data-ui="TileLineSetDefaultButton"]',
		);
		if (button === null) throw new Error("Missing Set default button.");
		expect(button.textContent).toBe("Set default");

		await act(async () => {
			button.click();
			await Promise.resolve();
			await Promise.resolve();
		});

		expect(runFx).toHaveBeenCalledTimes(1);
		expect(document.querySelector('[data-ui="TileLineDefaultBadge"]')?.textContent).toBe(
			"Default",
		);
		const unsetButton = document.querySelector<HTMLButtonElement>(
			'[data-ui="TileLineSetDefaultButton"]',
		);
		if (unsetButton === null) throw new Error("Missing Unset default button.");
		expect(unsetButton.disabled).toBe(false);
		expect(unsetButton.textContent).toBe("Unset default");

		await act(async () => {
			unsetButton.click();
			await Promise.resolve();
			await Promise.resolve();
		});

		expect(runFx).toHaveBeenCalledTimes(2);
		expect(document.querySelector('[data-ui="TileLineDefaultBadge"]')).toBeNull();
		expect(
			document.querySelector<HTMLButtonElement>('[data-ui="TileLineSetDefaultButton"]')
				?.textContent,
		).toBe("Set default");
	});
	it("counts active work down in the fixed runtime slot without adding a layout row", async () => {
		const { readControl } = await renderItemDetail();
		const owner = currentRuntime.items.find((item) => item.item.id === "workshop");
		if (owner === undefined) throw new Error("Missing Workshop runtime item.");

		await act(async () => {
			publishRuntime(
				RuntimeSchema.parse({
					...currentRuntime,
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

		const runtime = document.querySelector<HTMLElement>('[data-ui="TileLineRuntime"]');
		if (runtime === null) throw new Error("Missing line runtime slot.");
		expect(runtime.dataset.jobStatus).toBe(JobStatusEnumSchema.enum.Running);
		expect(document.querySelector('[data-ui="TileLine"]')?.textContent).not.toContain(
			"Running",
		);
		expect(document.querySelector('[data-ui="TileLineRuntimeValue"]')?.textContent).toBe(
			"0.4 s",
		);
		expect(document.querySelector('[data-ui="TileLineRuntimeDetail"]')?.textContent).toBe(
			"Remaining of 1 s",
		);
		expect(document.body.textContent).not.toContain("Current work");

		await act(async () => {
			publishRuntime(
				RuntimeSchema.parse({
					...currentRuntime,
					jobs: currentRuntime.jobs.map((job) => ({
						...job,
						remainingMs: 200,
					})),
				}),
			);
			await Promise.resolve();
		});

		expect(document.querySelector('[data-ui="TileLineRuntime"]')).toBe(runtime);
		expect(document.querySelector('[data-ui="TileLineRuntimeValue"]')?.textContent).toBe(
			"0.2 s",
		);

		await act(async () => {
			publishRuntime(
				RuntimeSchema.parse({
					...currentRuntime,
					jobs: currentRuntime.jobs.map((job) => ({
						...job,
						remainingMs: 0,
					})),
				}),
			);
			await Promise.resolve();
		});

		expect(document.querySelector('[data-ui="TileLineRuntime"]')).toBe(runtime);
		expect(runtime.dataset.jobStatus).toBe(JobStatusEnumSchema.enum.AwaitingOutput);
		expect(document.querySelector('[data-ui="TileLineRuntimeValue"]')?.textContent).toBe(
			"Complete",
		);
		expect(document.querySelector('[data-ui="TileLineRuntimeDetail"]')?.textContent).toBe(
			"Awaiting output",
		);
	});
});
