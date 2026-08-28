// @vitest-environment jsdom

import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { installRendererNativeDragGuardFx } from "~/renderer/installRendererNativeDragGuardFx";

describe("installRendererNativeDragGuardFx", () => {
	it("prevents native descendant drags until its process listener is removed", () => {
		const root = document.createElement("div");
		const link = document.createElement("a");
		link.href = "arkini://app/arkpacks";
		root.append(link);
		document.body.append(root);

		const remove = Effect.runSync(
			installRendererNativeDragGuardFx({
				root,
			}),
		);
		const blocked = new Event("dragstart", {
			bubbles: true,
			cancelable: true,
		});
		expect(link.dispatchEvent(blocked)).toBe(false);
		expect(blocked.defaultPrevented).toBe(true);

		remove();
		const allowed = new Event("dragstart", {
			bubbles: true,
			cancelable: true,
		});
		expect(link.dispatchEvent(allowed)).toBe(true);
		expect(allowed.defaultPrevented).toBe(false);
	});
});
