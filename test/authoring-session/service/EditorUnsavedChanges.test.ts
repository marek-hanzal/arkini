import { Deferred, Effect } from "effect";
import { describe, expect, it, vi } from "vitest";

import { createEditorUnsavedChangesOwnerFx } from "~/authoring-session/fx/createEditorUnsavedChangesOwnerFx";

const createSession = ({ valid = true }: { readonly valid?: boolean } = {}) => ({
	discardFn: vi.fn(),
	isDirtyFn: () => true,
	isValidFn: () => valid,
	ownsPathnameFn: (pathname: string) => pathname.startsWith("/editor/project/item/form/"),
	saveFn: vi.fn(async () => true),
});

describe("EditorUnsavedChanges", () => {
	it("allows navigation inside the owning form and defaults an outside navigation to Cancel", async () => {
		const owner = Effect.runSync(createEditorUnsavedChangesOwnerFx());
		owner.registerFn("item", createSession());

		await expect(owner.requestLeaveFn("/editor/project/item/form/artwork")).resolves.toBe(true);
		const leaving = owner.requestLeaveFn("/editor/project/assets");
		await vi.waitFor(() => expect(owner.getSnapshotFn().promptOpen).toBe(true));
		expect(owner.getSnapshotFn().promptOpen).toBe(true);
		await owner.decideFn("cancel");
		await expect(leaving).resolves.toBe(false);
	});

	it("saves a valid dirty session before allowing navigation", async () => {
		const owner = Effect.runSync(createEditorUnsavedChangesOwnerFx());
		const session = createSession();
		owner.registerFn("item", session);

		const leaving = owner.requestLeaveFn("/main-menu");
		await vi.waitFor(() => expect(owner.getSnapshotFn().promptOpen).toBe(true));
		expect(owner.getSnapshotFn().canSave).toBe(true);
		await owner.decideFn("save");

		await expect(leaving).resolves.toBe(true);
		expect(session.saveFn).toHaveBeenCalledOnce();
		expect(session.discardFn).not.toHaveBeenCalled();
	});

	it("omits Save for an invalid draft and allows an explicit discard", async () => {
		const owner = Effect.runSync(createEditorUnsavedChangesOwnerFx());
		const session = createSession({
			valid: false,
		});
		owner.registerFn("item", session);

		const leaving = owner.requestLeaveFn("/main-menu");
		await vi.waitFor(() => expect(owner.getSnapshotFn().promptOpen).toBe(true));
		expect(owner.getSnapshotFn()).toMatchObject({
			canSave: false,
			promptOpen: true,
		});
		await owner.decideFn("save");
		expect(session.saveFn).not.toHaveBeenCalled();
		await owner.decideFn("discard");

		await expect(leaving).resolves.toBe(true);
		expect(session.discardFn).toHaveBeenCalledOnce();
	});

	it("keeps a deferred Save single-flight for every concurrent leave request", async () => {
		const owner = Effect.runSync(createEditorUnsavedChangesOwnerFx());
		const saved = Effect.runSync(Deferred.make<void>());
		const session = createSession();
		session.saveFn.mockImplementation(() =>
			Effect.runPromise(Deferred.await(saved)).then(() => true),
		);
		owner.registerFn("item", session);

		const firstLeave = owner.requestLeaveFn("/editor/project/assets");
		await vi.waitFor(() => expect(owner.getSnapshotFn().promptOpen).toBe(true));
		const saving = owner.decideFn("save");
		await Promise.resolve();
		const secondLeave = owner.requestLeaveFn("/main-menu");

		expect(secondLeave).toBe(firstLeave);
		await vi.waitFor(() => expect(owner.getSnapshotFn().saving).toBe(true));
		Effect.runSync(Deferred.succeed(saved, undefined));
		await saving;
		await expect(
			Promise.all([
				firstLeave,
				secondLeave,
			]),
		).resolves.toEqual([
			true,
			true,
		]);
		expect(session.saveFn).toHaveBeenCalledOnce();
	});

	it("settles a discarded validation and never republishes its stale prompt", async () => {
		const owner = Effect.runSync(createEditorUnsavedChangesOwnerFx());
		const validated = Effect.runSync(Deferred.make<boolean>());
		const session = createSession();
		const unregister = owner.registerFn("asset", {
			...session,
			isValidFn: () => Effect.runPromise(Deferred.await(validated)),
		});
		const leaving = owner.requestLeaveFn();
		owner.discardAllFn();
		unregister();
		await expect(leaving).resolves.toBe(false);
		Effect.runSync(Deferred.succeed(validated, true));
		await new Promise<void>((resolve) => setTimeout(resolve, 0));
		expect(owner.getSnapshotFn()).toMatchObject({
			promptOpen: false,
			hasDirtySession: false,
		});
	});

	it.each([
		true,
		false,
	])("ignores a replaced Save finishing with %s while a successor prompts", async (saved) => {
		const owner = Effect.runSync(createEditorUnsavedChangesOwnerFx());
		const completion = Effect.runSync(Deferred.make<boolean>());
		const previous = createSession();
		previous.saveFn.mockImplementation(() => Effect.runPromise(Deferred.await(completion)));
		const unregister = owner.registerFn("item", previous);
		const leaving = owner.requestLeaveFn();
		await vi.waitFor(() => expect(owner.getSnapshotFn().promptOpen).toBe(true));
		const saving = owner.decideFn("save");
		owner.discardAllFn();
		await expect(leaving).resolves.toBe(false);
		const successor = createSession();
		owner.registerFn("item", successor);
		unregister();
		const nextLeave = owner.requestLeaveFn();
		await vi.waitFor(() => expect(owner.getSnapshotFn().promptOpen).toBe(true));
		Effect.runSync(Deferred.succeed(completion, saved));
		await saving;
		expect(owner.getSnapshotFn()).toMatchObject({
			promptOpen: true,
			error: undefined,
			saving: false,
		});
		expect(successor.saveFn).not.toHaveBeenCalled();
		await owner.decideFn("cancel");
		await expect(nextLeave).resolves.toBe(false);
	});

	it("cancels a removed session's request without invalidating ordinary refreshes", async () => {
		const owner = Effect.runSync(createEditorUnsavedChangesOwnerFx());
		const session = createSession();
		const unregister = owner.registerFn("item", session);
		const leaving = owner.requestLeaveFn();
		owner.refreshFn();
		owner.registerFn("item", session);
		expect(owner.requestLeaveFn()).toBe(leaving);
		unregister();
		await expect(leaving).resolves.toBe(false);
		expect(owner.getSnapshotFn().promptOpen).toBe(false);
	});
});
