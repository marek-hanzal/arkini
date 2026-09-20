import { describe, expect, it } from "vitest";

import { resolveItemDetailTargetFn } from "~/item-detail-read/fn/resolveItemDetailTargetFn";
import {
	lineRunRuntime,
	lineRunTestConfig,
} from "~test/production-line/support/lineRunTestRuntime";

describe("resolveItemDetailTargetFn", () => {
	it("defaults full interfaces to Lines and keeps every requested detail section available", () => {
		const runtime = lineRunRuntime({});
		expect(
			resolveItemDetailTargetFn({
				itemId: "runtime:workshop",
				runtime,
			}),
		).toEqual({
			kind: "available",
			itemId: "runtime:workshop",
			tab: "lines",
		});
		for (const requestedTab of [
			"lines",
			"info",
		] as const) {
			expect(
				resolveItemDetailTargetFn({
					itemId: "runtime:workshop",
					requestedTab,
					runtime,
				}),
			).toMatchObject({
				tab: requestedTab,
			});
		}
	});

	it("opens Lines even with active or queued work", () => {
		const base = lineRunRuntime({});
		const request = {
			id: "request:workshop",
			ownerItemId: "runtime:workshop",
			lineId: "line:workshop:build",
		};
		const job = {
			...request,
			id: "job:workshop",
			durationMs: 1000,
			remainingMs: 500,
		};
		for (const runtime of [
			{
				...base,
				jobs: [
					job,
				],
			},
			{
				...base,
				jobQueue: [
					request,
				],
			},
		]) {
			expect(
				resolveItemDetailTargetFn({
					itemId: request.ownerItemId,
					runtime,
				}),
			).toMatchObject({
				tab: "lines",
			});
			expect(
				resolveItemDetailTargetFn({
					itemId: request.ownerItemId,
					runtime,
					requestedTab: "lines",
				}),
			).toMatchObject({
				tab: "lines",
			});
		}
		expect(
			resolveItemDetailTargetFn({
				itemId: request.ownerItemId,
				runtime: {
					...base,
					jobs: [
						{
							...job,
							ownerItemId: "runtime:other",
						},
					],
					jobQueue: [
						{
							...request,
							ownerItemId: "runtime:other",
						},
					],
				},
			}),
		).toMatchObject({
			tab: "lines",
		});
	});

	it("opens Lines for a default item without lines and rejects missing targets", () => {
		const runtime = lineRunRuntime({});
		const ordinaryRuntime = {
			...runtime,
			items: [
				{
					...runtime.items[0],
					item: lineRunTestConfig.items.water,
				},
			],
		};
		expect(
			resolveItemDetailTargetFn({
				itemId: "runtime:workshop",
				runtime: ordinaryRuntime,
			}),
		).toEqual({
			kind: "available",
			itemId: "runtime:workshop",
			tab: "lines",
		});
		expect(
			resolveItemDetailTargetFn({
				itemId: "runtime:missing",
				runtime,
			}),
		).toEqual({
			kind: "unavailable",
		});
	});
	it("keeps simple items on Info even when a production section is requested", () => {
		const source = lineRunRuntime({});
		const runtime = {
			...source,
			items: source.items.map((item) => ({
				...item,
				item: {
					...item.item,
					ui: "simple" as const,
				},
			})),
		};
		for (const requestedTab of [
			undefined,
			"lines",
		] as const) {
			expect(
				resolveItemDetailTargetFn({
					itemId: "runtime:workshop",
					runtime,
					requestedTab,
				}),
			).toMatchObject({
				tab: "info",
			});
		}
	});
});
