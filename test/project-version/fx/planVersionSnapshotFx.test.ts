import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { planVersionSnapshotFx } from "~/project-version/fx/planVersionSnapshotFx";
import { editorTestPayload } from "~test/project-authoring/support/editorTestPayload";

const planFx = (draft?: boolean) => {
	const water = editorTestPayload.config.items.water;
	if (water === undefined) throw new Error("Missing water fixture.");
	return planVersionSnapshotFx({
		arkpack: editorTestPayload.version,
		config: {
			...editorTestPayload.config,
			items: {
				...editorTestPayload.config.items,
				water: {
					...water,
					...(draft === undefined
						? {}
						: {
								draft,
							}),
				},
			},
		},
		resources: editorTestPayload.resources,
		scenarios: [],
	});
};

describe("planVersionSnapshotFx", () => {
	it("canonicalizes omitted and false draft status while preserving true", () => {
		const omitted = Effect.runSync(planFx());
		const completed = Effect.runSync(planFx(false));
		const draft = Effect.runSync(planFx(true));

		expect(completed.contentFingerprint).toBe(omitted.contentFingerprint);
		expect(completed.manifest.items).toEqual(omitted.manifest.items);
		expect(draft.contentFingerprint).not.toBe(omitted.contentFingerprint);
		expect(draft.manifest.items.water).not.toBe(omitted.manifest.items.water);
	});
});
