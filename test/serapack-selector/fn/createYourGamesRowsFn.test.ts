import { describe, expect, it } from "vitest";

import type { ProjectCandidate } from "~/project-authoring/schema/ProjectCandidateSchema";
import type { SerapackDescriptor } from "~/serapack-catalog/type/SerapackDescriptor";
import { createYourGamesRowsFn } from "~/serapack-selector/fn/createYourGamesRowsFn";

const packageFor = (packageId: string, title: string): SerapackDescriptor => ({
	packageId,
	contentHash: "a".repeat(64),
	title,
	version: "1.0",
	serakki: "1",
	provenance: {
		type: "community",
	},
	source: "user",
});

const projectFor = (projectId: string, title: string, updatedAtMs: number): ProjectCandidate => ({
	type: "valid",
	ownership: "managed",
	project: {
		projectId,
		title,
		version: {
			major: 1,
			minor: 0,
		},
		createdAtMs: 1,
		updatedAtMs,
	},
});

describe("createYourGamesRowsFn", () => {
	it("joins exact game identities without losing Editor order or package-only games", () => {
		const recent = projectFor("game:shared", "Editor title", 30);
		const older = projectFor("game:project-only", "Project only", 20);
		const invalid: ProjectCandidate = {
			type: "invalid",
			root: "/broken-project",
			title: "Broken project",
			validationError: "Invalid files",
		};
		const rows = createYourGamesRowsFn(
			[
				recent,
				older,
				invalid,
			],
			[
				packageFor("game:shared", "Older packaged title"),
				packageFor("game:z", "Zeta"),
				packageFor("game:a", "Alpha"),
			],
		);

		expect(rows.map((row) => row.type)).toEqual([
			"project",
			"project",
			"serapack",
			"serapack",
			"invalid-project",
		]);
		expect(rows[0]).toMatchObject({
			type: "project",
			candidate: {
				project: {
					title: "Editor title",
				},
			},
			serapack: {
				packageId: "game:shared",
			},
		});
		expect(rows[1]).toMatchObject({
			type: "project",
			serapack: undefined,
		});
		expect(rows[2]).toMatchObject({
			type: "serapack",
			serapack: {
				title: "Alpha",
			},
		});
		expect(rows[3]).toMatchObject({
			type: "serapack",
			serapack: {
				title: "Zeta",
			},
		});
	});
});
