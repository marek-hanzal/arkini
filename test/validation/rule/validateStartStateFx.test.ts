import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { GameConfigSchema } from "~/engine/schema/GameConfigSchema";
import { validateStartStateFx } from "~/engine/validation/rule/validateStartStateFx";
import { startTestConfig } from "~test/start/fx/support/startTestConfig";
import { DiagnosticCodeEnumSchema } from "~/engine/validation/schema/DiagnosticCodeEnumSchema";

const provenance = {
	start: "start.json",
	categories: {},
	items: {},
};

describe("validateStartStateFx", () => {
	it("accepts a start state that the runtime builder can materialize", () => {
		const diagnostics = Effect.runSync(
			validateStartStateFx({
				config: startTestConfig,
				provenance,
			}),
		);

		expect(diagnostics).toEqual([]);
	});

	it("rejects conflicting board locations", () => {
		const config = GameConfigSchema.parse({
			...startTestConfig,
			start: {
				currentSpace: 0,
				board: [
					{
						space: 0,
						itemId: "tree",
						x: 0,
						y: 0,
					},
					{
						space: 0,
						itemId: "tree",
						x: 0,
						y: 0,
					},
				],
				inventory: [],
			},
		});
		const diagnostics = Effect.runSync(
			validateStartStateFx({
				config,
				provenance,
			}),
		);

		expect(diagnostics).toEqual([
			expect.objectContaining({
				code: DiagnosticCodeEnumSchema.enum.StartInvalid,
				failureTag: "RuntimeInvalidError",
				path: [
					"start",
				],
				source: "start.json",
			}),
		]);
	});

	it("rejects unavailable inventory capacity", () => {
		const config = GameConfigSchema.parse({
			...startTestConfig,
			meta: {
				...startTestConfig.meta,
				inventory: {
					width: 1,
					height: 1,
				},
			},
		});
		const diagnostics = Effect.runSync(
			validateStartStateFx({
				config,
				provenance,
			}),
		);

		expect(diagnostics[0]).toMatchObject({
			code: DiagnosticCodeEnumSchema.enum.StartInvalid,
			failureTag: "StartInventoryUnavailableError",
		});
	});

	it.each([
		{
			name: "undefined toolbar",
			meta: {
				...startTestConfig.meta,
				toolbarSize: undefined,
			},
			toolbar: [
				{
					itemId: "backpack",
					position: {
						x: 0,
						y: 0,
					},
				},
			],
		},
		{
			name: "disabled toolbar",
			meta: {
				...startTestConfig.meta,
				toolbarSize: 0,
			},
			toolbar: [
				{
					itemId: "backpack",
					position: {
						x: 0,
						y: 0,
					},
				},
			],
		},
		{
			name: "out-of-range toolbar slot",
			meta: startTestConfig.meta,
			toolbar: [
				{
					itemId: "backpack",
					position: {
						x: 2,
						y: 0,
					},
				},
			],
		},
		{
			name: "non-zero toolbar row",
			meta: startTestConfig.meta,
			toolbar: [
				{
					itemId: "backpack",
					position: {
						x: 0,
						y: 1,
					},
				},
			],
		},
		{
			name: "non-toolbar item",
			meta: startTestConfig.meta,
			toolbar: [
				{
					itemId: "tree",
					position: {
						x: 0,
						y: 0,
					},
				},
			],
		},
		{
			name: "duplicate toolbar slot",
			meta: startTestConfig.meta,
			toolbar: [
				{
					itemId: "backpack",
					position: {
						x: 0,
						y: 0,
					},
				},
				{
					itemId: "log",
					position: {
						x: 0,
						y: 0,
					},
				},
			],
		},
	])("rejects $name through canonical start validation", ({ meta, toolbar }) => {
		const config = GameConfigSchema.parse({
			...startTestConfig,
			meta,
			start: {
				currentSpace: 0,
				board: [],
				inventory: [],
				toolbar,
			},
		});
		const diagnostics = Effect.runSync(
			validateStartStateFx({
				config,
				provenance,
			}),
		);

		expect(diagnostics).toEqual([
			expect.objectContaining({
				code: DiagnosticCodeEnumSchema.enum.StartInvalid,
				failureTag: "RuntimeInvalidError",
				path: [
					"start",
				],
				source: "start.json",
			}),
		]);
	});
});
