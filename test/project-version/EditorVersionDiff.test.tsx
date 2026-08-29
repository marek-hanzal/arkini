import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { EditorProjectVersionDiff } from "~/project-version/EditorProjectVersion";
import { EditorVersionDiff } from "~/project-version/workspace/EditorVersionDiff";

describe("EditorVersionDiff", () => {
	it("renders the canonical major and minor classifications on their exact changes", () => {
		const diff: EditorProjectVersionDiff = {
			from: {
				type: "version",
				versionId: "before",
			},
			to: {
				type: "current",
			},
			hasChanges: true,
			project: [
				{
					before: 9,
					after: 8,
					bump: "major",
					path: "config.meta.board.height",
				},
			],
			items: [
				{
					change: "changed",
					uid: "academy",
					values: [
						{
							before: "Academy 2",
							after: "Academy",
							bump: "minor",
							path: "title",
						},
					],
				},
			],
			resources: [],
			scenarios: [],
		};

		const markup = renderToStaticMarkup(<EditorVersionDiff diff={diff} />);

		expect(markup.match(/data-bump="major"/g)).toHaveLength(1);
		expect(markup.match(/data-bump="minor"/g)).toHaveLength(1);
	});
});
