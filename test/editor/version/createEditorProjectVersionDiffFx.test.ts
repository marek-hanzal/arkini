import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { createEditorProjectVersionDiffFx } from "~/editor/version/createEditorProjectVersionDiffFx";
import { GameConfigSchema } from "~/engine/schema/GameConfigSchema";
import { editorTestPayload } from "~test/editor/support/editorTestPayload";

describe("createEditorProjectVersionDiffFx", () => {
	it("projects the canonical compatibility diff and classifies opaque resource changes", () => {
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
				board: {
					...editorTestPayload.config.meta.board,
					height: 1,
				},
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
		const diff = Effect.runSync(
			createEditorProjectVersionDiffFx(
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
					arkpackVersion: "2.0",
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
			),
		);

		expect(diff.from).toEqual(from);
		expect(diff.to).toEqual(to);
		expect(diff.hasChanges).toBe(true);
		expect(diff.project).toEqual([
			{
				path: "arkpackVersion",
				before: "1.0",
				after: "2.0",
			},
			{
				path: "config.meta.board.height",
				before: 2,
				after: 1,
				bump: "major",
			},
			{
				path: "config.meta.title",
				before: editorTestPayload.config.meta.title,
				after: "Changed project",
				bump: "minor",
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
						bump: "major",
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
						bump: "minor",
					},
				],
			},
		]);
		expect(diff.resources).toEqual([
			{
				change: "added",
				bump: "minor",
				id: "added",
			},
			{
				change: "deleted",
				bump: "minor",
				id: "deleted",
			},
			{
				change: "changed",
				bump: "minor",
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
