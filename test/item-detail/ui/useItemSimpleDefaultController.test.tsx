// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import { useItemSimpleDefaultController } from "~/item-detail/ui/useItemSimpleDefaultController";

(
	globalThis as {
		IS_REACT_ACT_ENVIRONMENT?: boolean;
	}
).IS_REACT_ACT_ENVIRONMENT = true;

const state = vi.hoisted(() => ({
	enqueueFn: vi.fn(),
	game: {
		runFx: vi.fn(),
	},
}));

vi.mock("@effect/atom-react", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@effect/atom-react")>();
	const AsyncResult = await import("effect/unstable/reactivity/AsyncResult");
	return {
		...actual,
		useAtom: () => [
			AsyncResult.initial(),
			state.enqueueFn,
		],
	};
});
vi.mock("~/game-presentation/ui/useGameEngine", () => ({
	useGameEngine: () => state.game,
}));

it("keeps Simple action visually ready during covered autofill without admitting an early start", async () => {
	const host = document.createElement("div");
	document.body.append(host);
	const root = createRoot(host);
	let output: useItemSimpleDefaultController.Output | undefined;
	const Probe = (props: useItemSimpleDefaultController.Props) => {
		output = useItemSimpleDefaultController(props);
		return null;
	};
	const base = {
		ownerItemId: "owner",
		lineUid: "line:a",
		disabled: false,
	};
	try {
		await act(async () =>
			root.render(
				<Probe
					{...base}
					ready
					autofillCovered={false}
				/>,
			),
		);
		await act(async () => {
			await new Promise<void>((resolve) => setTimeout(resolve, 520));
		});
		expect(output?.displayReady).toBe(true);

		await act(async () =>
			root.render(
				<Probe
					{...base}
					ready={false}
					autofillCovered
				/>,
			),
		);
		await act(async () => {
			await new Promise<void>((resolve) => setTimeout(resolve, 520));
		});
		expect(output?.displayReady).toBe(true);
		output?.startFn();
		expect(state.enqueueFn).not.toHaveBeenCalled();

		await act(async () =>
			root.render(
				<Probe
					{...base}
					lineUid="line:b"
					ready={false}
					autofillCovered
				/>,
			),
		);
		expect(output?.displayReady).toBe(false);

		await act(async () =>
			root.render(
				<Probe
					{...base}
					ready
					autofillCovered={false}
				/>,
			),
		);
		expect(output?.displayReady).toBe(true);
	} finally {
		state.enqueueFn.mockClear();
		await act(async () => root.unmount());
		host.remove();
	}
});
