// @vitest-environment jsdom

import {
	act,
	createElement,
	type Dispatch,
	startTransition,
	Suspense,
	type SetStateAction,
	useEffect,
	useState,
} from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useRetainedItemDetailProjection } from "~/item-detail-frame/useRetainedItemDetailProjection";

(
	globalThis as {
		IS_REACT_ACT_ENVIRONMENT?: boolean;
	}
).IS_REACT_ACT_ENVIRONMENT = true;

interface ProjectionState {
	readonly available: boolean;
	readonly suspend: boolean;
	readonly value: string;
}

const suspended = new Promise<never>(() => undefined);
const roots: Array<ReturnType<typeof createRoot>> = [];

afterEach(async () => {
	await act(async () => {
		for (const root of roots.splice(0)) root.unmount();
	});
	document.body.replaceChildren();
});

describe("Item Detail retained projection", () => {
	it("retains only committed projections when a concurrent render is abandoned", async () => {
		let update: Dispatch<SetStateAction<ProjectionState>> | undefined;
		const renderedAbandonedValue = vi.fn();
		const Projection = ({ state }: { readonly state: ProjectionState }) => {
			const projection = useRetainedItemDetailProjection({
				available: state.available,
				targetKey: "runtime:item",
				value: state.value,
			});
			if (state.suspend) {
				renderedAbandonedValue(state.value);
				throw suspended;
			}
			return createElement("span", {
				"data-stale": projection.stale ? "true" : "false",
				"data-value": projection.value,
			});
		};
		const Harness = () => {
			const [state, setState] = useState<ProjectionState>({
				available: true,
				suspend: false,
				value: "committed",
			});
			useEffect(() => {
				update = setState;
				return () => {
					update = undefined;
				};
			}, []);
			return createElement(
				Suspense,
				{
					fallback: null,
				},
				createElement(Projection, {
					state,
				}),
			);
		};

		const container = document.createElement("div");
		document.body.append(container);
		const root = createRoot(container);
		roots.push(root);
		await act(async () => root.render(createElement(Harness)));

		await act(async () => {
			startTransition(() =>
				update?.({
					available: true,
					suspend: true,
					value: "abandoned",
				}),
			);
			await Promise.resolve();
		});
		expect(renderedAbandonedValue).toHaveBeenCalledWith("abandoned");

		await act(async () => {
			update?.({
				available: false,
				suspend: false,
				value: "unavailable",
			});
		});
		const retained = container.querySelector("span");
		expect(retained?.dataset.stale).toBe("true");
		expect(retained?.dataset.value).toBe("committed");
	});
});
