import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { compileEditorAcquisitionRootsFx } from "~/editor/acquisition/compileEditorAcquisitionRootsFx";
import { createMultiOutputLimitationConfigFx } from "~test/editor/acquisition/compileEditorAcquisitionRootsFx.test/fixture";

describe("compileEditorAcquisitionRootsFx", () => {
	it("preserves first-ruled-output limitation short-circuiting", () => {
		const config = Effect.runSync(createMultiOutputLimitationConfigFx());
		const { limitations } = Effect.runSync(compileEditorAcquisitionRootsFx(config));

		expect(limitations).toContain("spatial-requirements-approximated");
		expect(limitations).not.toContain("negative-availability-constraints-ignored");
	});
});
