// @vitest-environment jsdom

import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import { ItemProductionRow } from "~/item-detail/ui/ItemProductionRow";
import type { LineSchema } from "~/production-line/schema/LineSchema";

(
	globalThis as {
		IS_REACT_ACT_ENVIRONMENT?: boolean;
	}
).IS_REACT_ACT_ENVIRONMENT = true;

it("activates the row without stealing nested controls or activating an unavailable row", async () => {
	const host = document.createElement("div");
	document.body.append(host);
	const root = createRoot(host);
	const activateFn = vi.fn();
	const controlFn = vi.fn();
	const line = {
		uid: "line",
		title: "Production",
		runtimeMs: 1000,
	} as LineSchema.Type;
	const renderFn = (enabled: boolean) =>
		root.render(
			<ItemProductionRow
				line={line}
				activateFn={enabled ? activateFn : undefined}
				actions={
					<button onClick={controlFn}>
						<svg>
							<path />
						</svg>
					</button>
				}
				inputs={
					<>
						<button disabled>
							<span>Input</span>
						</button>
						<button onClick={controlFn}>Input action</button>
					</>
				}
			/>,
		);
	try {
		await act(async () => renderFn(true));
		await act(async () => {
			host.querySelector("h3")!.click();
			host.querySelector("article")!.click();
		});
		expect(activateFn).toHaveBeenCalledTimes(2);
		await act(async () => {
			host.querySelector("button path")!.dispatchEvent(
				new MouseEvent("click", {
					bubbles: true,
				}),
			);
			host.querySelector("button:disabled span")!.dispatchEvent(
				new MouseEvent("click", {
					bubbles: true,
				}),
			);
			host.querySelectorAll("button")[2].click();
		});
		expect(controlFn).toHaveBeenCalledTimes(2);
		expect(activateFn).toHaveBeenCalledTimes(2);
		await act(async () => renderFn(false));
		await act(async () => host.querySelector("h3")!.click());
		expect(activateFn).toHaveBeenCalledTimes(2);
	} finally {
		await act(async () => root.unmount());
		host.remove();
	}
});
