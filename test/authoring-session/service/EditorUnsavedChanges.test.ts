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
});
