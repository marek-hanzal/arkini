// @vitest-environment jsdom
import { Effect } from "effect";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";

import { JobQueueFullError } from "~/production-job/error/JobQueueFullError";
import { useItemLineMakeController } from "~/item-detail/ui/useItemLineMakeController";

(
	globalThis as {
		IS_REACT_ACT_ENVIRONMENT?: boolean;
	}
).IS_REACT_ACT_ENVIRONMENT = true;
const state = vi.hoisted(() => ({
	enqueueFx: vi.fn(),
	game: {
		runFx: vi.fn(),
	},
}));
vi.mock("~/game-presentation/ui/useGameEngine", () => ({
	useGameEngine: () => state.game,
}));
vi.mock("~/production-job/fx/enqueueLineFx", () => ({
	enqueueLineFx: state.enqueueFx,
}));
vi.mock("~/translation/ui/useTranslator", () => ({
	useTranslator: () => ({
		textFn: (text: string) => text,
	}),
}));
vi.mock("~/application-runtime/service/RendererRuntime", () => ({
	RendererRuntime: {
		runSync: Effect.runSync,
	},
}));

it("queues the exact selected owner and line, blocks disabled submissions, and permits retry after a rejected admission", async () => {
	state.game.runFx.mockImplementation((effect) => effect);
	state.enqueueFx.mockReturnValue(
		Effect.succeed({
			id: "request",
		}),
	);
	let output: useItemLineMakeController.Output | undefined;
	const Probe = (props: useItemLineMakeController.Props) => {
		output = useItemLineMakeController(props);
		return null;
	};
	const root = createRoot(document.createElement("div"));
	const renderFn = (props: useItemLineMakeController.Props) =>
		act(async () => root.render(<Probe {...props} />));
	try {
		await renderFn({
			ownerItemId: "owner:a",
			lineUid: "line:second",
			disabled: false,
		});
		await act(async () => output!.makeFn());
		expect(state.enqueueFx).toHaveBeenCalledExactlyOnceWith({
			ownerItemId: "owner:a",
			lineUid: "line:second",
		});
		expect(state.game.runFx).toHaveBeenCalledTimes(1);
		await renderFn({
			ownerItemId: "owner:a",
			lineUid: "line:second",
			disabled: true,
		});
		await act(async () => output!.makeFn());
		await renderFn({
			lineUid: "line:second",
			disabled: false,
		});
		await act(async () => output!.makeFn());
		expect(state.enqueueFx).toHaveBeenCalledTimes(1);

		state.enqueueFx.mockReturnValue(
			Effect.fail(
				new JobQueueFullError({
					ownerItemId: "owner:a",
					maxQueueSize: 1,
					queueSize: 1,
				}),
			),
		);
		await renderFn({
			ownerItemId: "owner:a",
			lineUid: "line:second",
			disabled: false,
		});
		await act(async () => output!.makeFn());
		expect(output!.pending).toBe(false);
		await renderFn({
			ownerItemId: "owner:b",
			lineUid: "line:second",
			disabled: false,
		});
		state.enqueueFx.mockReturnValue(
			Effect.succeed({
				id: "request:b",
			}),
		);
		await act(async () => output!.makeFn());
		expect(state.enqueueFx).toHaveBeenLastCalledWith({
			ownerItemId: "owner:b",
			lineUid: "line:second",
		});
	} finally {
		await act(async () => root.unmount());
	}
});
