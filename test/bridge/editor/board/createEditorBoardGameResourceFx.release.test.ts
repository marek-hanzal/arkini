import { Effect, SubscriptionRef } from "effect";
import { describe, expect, it } from "@effect/vitest";
import { vi } from "vitest";

import { createEditorBoardGameResourceFx } from "~/bridge/editor/board/createEditorBoardGameResourceFx";
import { failedCreationProject } from "~test/bridge/editor/board/createEditorBoardGameResourceFx.release.test/failedCreationProject";

describe("createEditorBoardGameResourceFx release", () => {
	it.effect("clears a failed creation when routed ownership is released", () =>
		Effect.gen(function* () {
			const creationError = new Error("editor game creation failed");
			const createResourceFx = vi.fn(() => Effect.fail(creationError));
			const owner = yield* createEditorBoardGameResourceFx({
				createResourceFx,
			});

			yield* owner.syncFx(failedCreationProject);
			expect((yield* SubscriptionRef.get(owner.state)).type).toBe("failed");

			yield* owner.releaseCurrentFx;
			yield* owner.releaseCurrentFx;
			expect(yield* SubscriptionRef.get(owner.state)).toEqual({
				type: "idle",
			});
			expect(createResourceFx).toHaveBeenCalledOnce();
		}),
	);
});
