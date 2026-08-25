import { describe, expect, it } from "vitest";

import { createEditorProjectVersionDiff } from "~/editor/version/createEditorProjectVersionDiff";
import { GameConfigSchema } from "~/engine/schema/GameConfigSchema";
import { editorTestPayload } from "~test/editor/support/editorTestPayload";

describe("createEditorProjectVersionDiff", () => {
	it("separates structural project and item changes from opaque binary changes", () => {
		const oil = {
			...editorTestPayload.config.items.water,
			id: "oil",
			uid: "oil",
			title: "Oil",
		};
		const afterConfig = GameConfigSchema.parse({
			...editorTestPayload.config,
			meta: {
				...editorTestPayload.config.meta,
				title: "Changed project",
			},
			items: {
				oil,
				water: {
					...editorTestPayload.config.items.water,
					description: "Changed water",
				},
			},
		});
		const from = {
			type: "version" as const,
			versionId: "before",
		};
		const to = {
			type: "current" as const,
		};
		const diff = createEditorProjectVersionDiff(
			from,
			to,
			{
				arkpackVersion: "1.0",
				config: editorTestPayload.config,
				resources: new Map([
					[
						"deleted",
						"deleted-hash",
					],
					[
						"hero",
						"old-hero-hash",
					],
				]),
				scenarios: new Map([
					[
						"Opening",
						"same-save-hash",
					],
				]),
			},
			{
				arkpackVersion: "1.1",
				config: afterConfig,
				resources: new Map([
					[
						"added",
						"added-hash",
					],
					[
						"hero",
						"new-hero-hash",
					],
				]),
				scenarios: new Map([
					[
						"Opening",
						"same-save-hash",
					],
					[
						"Variant",
						"new-save-hash",
					],
				]),
			},
		);

		expect(diff.from).toEqual(from);
		expect(diff.to).toEqual(to);
		expect(diff.hasChanges).toBe(true);
		expect(diff.project).toEqual([
			{
				path: "arkpackVersion",
				before: "1.0",
				after: "1.1",
			},
			{
				path: "config.meta.title",
				before: editorTestPayload.config.meta.title,
				after: "Changed project",
			},
		]);
		expect(diff.items).toEqual([
			{
				change: "added",
				uid: "oil",
				values: [
					{
						path: "",
						after: oil,
					},
				],
			},
			{
				change: "changed",
				uid: "water",
				values: [
					{
						path: "description",
						before: "Water",
						after: "Changed water",
					},
				],
			},
		]);
		expect(diff.resources).toEqual([
			{
				change: "added",
				id: "added",
			},
			{
				change: "deleted",
				id: "deleted",
			},
			{
				change: "changed",
				id: "hero",
			},
		]);
		expect(diff.scenarios).toEqual([
			{
				change: "added",
				id: "Variant",
			},
		]);
	});
});
