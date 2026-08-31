import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { compileAcquisitionRootsFn } from "~/flow/fn/compileAcquisitionRootsFn";
import { createMultiOutputLimitationConfigFx } from "~test/flow/fn/compileAcquisitionRootsFn.test/fixture";

describe("compileAcquisitionRootsFn", () => {
	it("preserves first-ruled-output limitation short-circuiting", () => {
		const config = Effect.runSync(createMultiOutputLimitationConfigFx());
		const { limitations } = compileAcquisitionRootsFn(config);

		expect(limitations).toContain("spatial-requirements-approximated");
		expect(limitations).not.toContain("negative-availability-constraints-ignored");
	});
});
