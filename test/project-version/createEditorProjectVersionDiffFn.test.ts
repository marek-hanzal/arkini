import { describe, expect, it } from "vitest";

import { createEditorProjectVersionDiffFn } from "~/project-version/fn/createEditorProjectVersionDiffFn";
import { GameConfigSchema } from "~/game-config/GameConfigSchema";
import { editorTestPayload } from "~test/editor/support/editorTestPayload";

const from = {
	type: "version" as const,
	versionId: "before",
};
const to = {
	type: "current" as const,
};

const readConfigDiff = (before: GameConfigSchema.Type, after: GameConfigSchema.Type) =>
	createEditorProjectVersionDiffFn(
		from,
		to,
		{
			arkpackVersion: "1.0",
			config: before,
			resources: new Map(),
			scenarios: new Map(),
		},
		{
			arkpackVersion: "2.0",
			config: after,
			resources: new Map(),
			scenarios: new Map(),
		},
	);

describe("createEditorProjectVersionDiffFn", () => {
	it("keeps an item ID rename under its UID when another item releases that ID", () => {
		const reserved = {
			...editorTestPayload.config.items.water,
			id: "reserved",
			uid: "reserved",
			title: "Reserved",
		};
		const beforeConfig = GameConfigSchema.parse({
			...editorTestPayload.config,
			items: {
				reserved,
				water: editorTestPayload.config.items.water,
			},
		});
		const afterConfig = GameConfigSchema.parse({
			...beforeConfig,
			start: {
				...beforeConfig.start,
				board: beforeConfig.start.board.map((item) => ({
					...item,
					itemId: "reserved",
				})),
			},
			items: {
				reserved: {
					...beforeConfig.items.water,
					id: "reserved",
				},
			},
		});
		const diff = readConfigDiff(beforeConfig, afterConfig);

		expect(diff.items).toEqual([
			{
				change: "deleted",
				uid: "reserved",
				values: [
					{
						before: reserved,
						bump: "major",
						path: "",
					},
				],
			},
			{
				change: "changed",
				uid: "water",
				values: [
					{
						before: "water",
						after: "reserved",
						bump: "major",
						path: "id",
					},
				],
			},
		]);
	});

	it("keeps replacement item identities separate when one item ID changes UID", () => {
		const afterConfig = GameConfigSchema.parse({
			...editorTestPayload.config,
			items: {
				water: {
					...editorTestPayload.config.items.water,
					uid: "water-new",
				},
			},
		});
		const diff = readConfigDiff(editorTestPayload.config, afterConfig);

		expect(diff.items).toEqual([
			{
				change: "deleted",
				uid: "water",
				values: [
					{
						before: editorTestPayload.config.items.water,
						bump: "major",
						path: "",
					},
				],
			},
			{
				change: "added",
				uid: "water-new",
				values: [
					{
						after: afterConfig.items.water,
						bump: "major",
						path: "",
					},
				],
			},
		]);
	});

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
		const diff = createEditorProjectVersionDiffFn(
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
