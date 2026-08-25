import { Deferred, Effect } from "effect";
import { describe, expect, it, vi } from "vitest";

import { createEditorUnsavedChangesOwnerFx } from "~/bridge/editor/createEditorUnsavedChangesOwnerFx";

const createSession = ({ valid = true }: { readonly valid?: boolean } = {}) => ({
	discard: vi.fn(),
	isDirty: () => true,
	isValid: () => valid,
	ownsPathname: (pathname: string) => pathname.startsWith("/editor/project/item/form/"),
	save: vi.fn(async () => true),
});

describe("EditorUnsavedChanges", () => {
	it("allows navigation inside the owning form and defaults an outside navigation to Cancel", async () => {
		const owner = Effect.runSync(createEditorUnsavedChangesOwnerFx());
		owner.register("item", createSession());

		await expect(owner.requestLeave("/editor/project/item/form/artwork")).resolves.toBe(true);
		const leaving = owner.requestLeave("/editor/project/assets");
		await vi.waitFor(() => expect(owner.getSnapshot().promptOpen).toBe(true));
		expect(owner.getSnapshot().promptOpen).toBe(true);
		await owner.decide("cancel");
		await expect(leaving).resolves.toBe(false);
	});

	it("saves a valid dirty session before allowing navigation", async () => {
		const owner = Effect.runSync(createEditorUnsavedChangesOwnerFx());
		const session = createSession();
		owner.register("item", session);

		const leaving = owner.requestLeave("/main-menu");
		await vi.waitFor(() => expect(owner.getSnapshot().promptOpen).toBe(true));
		expect(owner.getSnapshot().canSave).toBe(true);
		await owner.decide("save");

		await expect(leaving).resolves.toBe(true);
		expect(session.save).toHaveBeenCalledOnce();
		expect(session.discard).not.toHaveBeenCalled();
	});

	it("omits Save for an invalid draft and allows an explicit discard", async () => {
		const owner = Effect.runSync(createEditorUnsavedChangesOwnerFx());
		const session = createSession({
			valid: false,
		});
		owner.register("item", session);

		const leaving = owner.requestLeave("/main-menu");
		await vi.waitFor(() => expect(owner.getSnapshot().promptOpen).toBe(true));
		expect(owner.getSnapshot()).toMatchObject({
			canSave: false,
			promptOpen: true,
		});
		await owner.decide("save");
		expect(session.save).not.toHaveBeenCalled();
		await owner.decide("discard");

		await expect(leaving).resolves.toBe(true);
		expect(session.discard).toHaveBeenCalledOnce();
	});

	it("keeps a deferred Save single-flight for every concurrent leave request", async () => {
		const owner = Effect.runSync(createEditorUnsavedChangesOwnerFx());
		const saved = Effect.runSync(Deferred.make<void>());
		const session = createSession();
		session.save.mockImplementation(() =>
			Effect.runPromise(Deferred.await(saved)).then(() => true),
		);
		owner.register("item", session);

		const firstLeave = owner.requestLeave("/editor/project/assets");
		await vi.waitFor(() => expect(owner.getSnapshot().promptOpen).toBe(true));
		const saving = owner.decide("save");
		await Promise.resolve();
		const secondLeave = owner.requestLeave("/main-menu");

		expect(secondLeave).toBe(firstLeave);
		await vi.waitFor(() => expect(owner.getSnapshot().saving).toBe(true));
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
		expect(session.save).toHaveBeenCalledOnce();
	});

});
