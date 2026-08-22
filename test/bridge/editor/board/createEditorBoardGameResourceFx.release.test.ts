import { Effect, SubscriptionRef } from "effect";
import { describe, expect, it, vi } from "vitest";

import { createEditorBoardGameResourceFx } from "~/bridge/editor/board/createEditorBoardGameResourceFx";
import { failedCreationProject } from "~test/bridge/editor/board/createEditorBoardGameResourceFx.release.test/failedCreationProject";

describe("createEditorBoardGameResourceFx release", () => {
	it("clears a failed creation when routed ownership is released", async () => {
		const creationError = new Error("editor game creation failed");
		const createResourceFx = vi.fn(() => Effect.fail(creationError));
		const owner = await Effect.runPromise(
			createEditorBoardGameResourceFx({
				createResourceFx,
			}),
		);

		await Effect.runPromise(owner.syncFx(failedCreationProject));
		expect((await Effect.runPromise(SubscriptionRef.get(owner.state))).type).toBe("failed");

		await Effect.runPromise(owner.releaseCurrentFx);
		await Effect.runPromise(owner.releaseCurrentFx);
		expect(await Effect.runPromise(SubscriptionRef.get(owner.state))).toEqual({
			type: "idle",
		});
		expect(createResourceFx).toHaveBeenCalledOnce();
	});
});
