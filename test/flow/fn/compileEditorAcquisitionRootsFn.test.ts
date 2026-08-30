import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { compileEditorAcquisitionRootsFn } from "~/flow/fn/compileEditorAcquisitionRootsFn";
import { createMultiOutputLimitationConfigFx } from "~test/flow/fn/compileEditorAcquisitionRootsFn.test/fixture";

describe("compileEditorAcquisitionRootsFn", () => {
	it("preserves first-ruled-output limitation short-circuiting", () => {
		const config = Effect.runSync(createMultiOutputLimitationConfigFx());
		const { limitations } = compileEditorAcquisitionRootsFn(config);

		expect(limitations).toContain("spatial-requirements-approximated");
		expect(limitations).not.toContain("negative-availability-constraints-ignored");
	});
});
