// @vitest-environment jsdom

import { describe, expect, it } from "vitest";
import { JobStatusEnumSchema } from "~/engine/job/schema/read/JobStatusEnumSchema";
import type { useItemDetailLines } from "~/bridge/item-detail/useItemDetailLines";
import { act } from "react";

import {
	__fixture_commands as commands,
	line,
	projection,
	renderLines,
} from "./ItemLinesTab.test/fixture";

describe("ItemLinesTab / line state and progress", () => {
	it("leaves an enqueue-ready line without a redundant readiness badge", async () => {
		await renderLines({
			...projection,
			line: [
				projection.line[0],
			],
		});

		expect(document.querySelector('[data-ui="TileLineReadinessBadge"]')).toBeNull();
		expect(document.body.textContent).not.toContain("Ready");
	});
	it("keeps Paused as the only active-job status badge", async () => {
		const paused = {
			...line({
				active: true,
				lineId: "line:paused",
				title: "Paused line",
			}),
			activeJob: {
				status: JobStatusEnumSchema.enum.Paused,
				durationMs: 1_000,
				remainingMs: 500,
			},
		} as const satisfies useItemDetailLines.Line;
		const { container, rerender } = await renderLines({
			...projection,
			line: [
				paused,
			],
		});

		expect(container.querySelector('[data-ui="TileLineStatusBadge"]')?.textContent).toBe(
			"Paused",
		);

		await rerender({
			...projection,
			line: [
				{
					...paused,
					activeJob: {
						...paused.activeJob,
						status: JobStatusEnumSchema.enum.AwaitingOutput,
					},
				},
			],
		});
		expect(container.querySelector('[data-ui="TileLineStatusBadge"]')).toBeNull();
	});
	it("keeps authored order, toggles default state, and reserves active border geometry", async () => {
		await renderLines();
		const rows = Array.from(document.querySelectorAll<HTMLElement>('[data-ui="TileLine"]'));
		expect(rows.map((row) => row.dataset.lineId)).toEqual([
			"line:first",
			"line:second",
		]);

		const buttons = Array.from(
			document.querySelectorAll<HTMLButtonElement>('[data-ui="TileLineSetDefaultButton"]'),
		);
		expect(buttons.map((button) => button.textContent)).toEqual([
			"Set default",
			"Unset default",
		]);

		await act(async () => {
			buttons[0]?.click();
			await Promise.resolve();
		});
		expect(commands.setDefault).toHaveBeenCalledWith({
			ownerItemId: "runtime:producer",
			lineId: "line:first",
		});

		await act(async () => {
			buttons[1]?.click();
			await Promise.resolve();
		});
		expect(commands.unsetDefault).toHaveBeenCalledWith({
			ownerItemId: "runtime:producer",
		});
	});
	it("fills the active row background with its exact completed progress", async () => {
		const { rerender } = await renderLines();
		const idleRow = document.querySelector<HTMLElement>('[data-line-id="line:first"]');
		const activeRow = document.querySelector<HTMLElement>('[data-line-id="line:second"]');
		const progress = activeRow?.querySelector<HTMLElement>('[data-ui="TileLineProgressFill"]');

		expect(idleRow?.querySelector('[data-ui="TileLineProgress"]')).toBeNull();
		expect(progress?.style.width).toBe("50%");

		await rerender({
			...projection,
			line: projection.line.map((candidate) =>
				candidate.lineId === "line:second" && candidate.activeJob !== undefined
					? {
							...candidate,
							activeJob: {
								...candidate.activeJob,
								remainingMs: 250,
							},
						}
					: candidate,
			),
		});
		expect(
			document.querySelector<HTMLElement>(
				'[data-line-id="line:second"] [data-ui="TileLineProgressFill"]',
			)?.style.width,
		).toBe("75%");
	});
	it("marks queued idle work in warning orange and explains its automatic start", async () => {
		const { container, rerender } = await renderLines({
			...projection,
			line: [
				{
					...projection.line[0],
					queuedRequestCount: 2,
				},
			],
		});
		const queuedLine = container.querySelector<HTMLElement>('[data-ui="TileLine"]');
		expect(queuedLine?.dataset.queued).toBe("true");
		expect(queuedLine?.querySelector('[data-ui="TileLineQueuedBadge"]')).toBeNull();
		expect(
			queuedLine?.querySelector('[data-ui="TileLineQueuedMessage"]')?.textContent,
		).toContain("Queued for automatic start when the required inputs become available.");

		await rerender({
			...projection,
			line: [
				{
					...projection.line[1],
					queuedRequestCount: 2,
				},
			],
		});
		const activeLine = container.querySelector<HTMLElement>('[data-ui="TileLine"]');
		expect(activeLine?.dataset.active).toBe("true");
		expect(activeLine?.dataset.queued).toBe("false");
		expect(activeLine?.querySelector('[data-ui="TileLineQueuedBadge"]')).toBeNull();
		expect(activeLine?.querySelector('[data-ui="TileLineQueuedMessage"]')).toBeNull();
	});
});
