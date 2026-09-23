// @vitest-environment jsdom

import { RegistryContext, scheduleTask, useAtomValue } from "@effect/atom-react";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SerakkiDefaultPackageId } from "~shared/SerakkiAppMetadata";
import { GameConfigSchema } from "~/game-config/schema/GameConfigSchema";
import { AboutPortraitImagesAtom } from "~/launcher/atom/AboutPortraitImagesAtom";

(
	globalThis as {
		IS_REACT_ACT_ENVIRONMENT?: boolean;
	}
).IS_REACT_ACT_ENVIRONMENT = true;

const harness = vi.hoisted(() => ({
	loadFailure: undefined as Error | undefined,
	loadedPackageIds: [] as string[],
}));

const payload = {
	config: GameConfigSchema.parse({
		resources: {
			hero: "hero",
			"avatar-01": "avatar:two",
			"avatar-03": "avatar:missing",
			"avatar-05": "avatar:one",
			"avatar-08": "avatar:eight",
		},
		meta: {
			id: "game:about-portraits",
			title: "About portraits",
			board: {
				width: 1,
				height: 1,
			},
		},
		start: {
			currentSpace: 0,
			spaces: [],
		},
		items: {},
	}),
	resources: [
		{
			uid: "hero",
			type: "image",
			url: "serakki://game/resource/hero",
		},
		{
			uid: "avatar:one",
			type: "image",
			url: "serakki://game/resource/avatar-one",
		},
		{
			uid: "avatar:two",
			type: "image",
			url: "serakki://game/resource/avatar-two",
		},
		{
			uid: "avatar:eight",
			type: "image",
			url: "serakki://game/resource/avatar-eight",
		},
	],
};

vi.mock("~/serapack-catalog/fx/loadSerapackFx", async () => {
	const { Effect } = await import("effect");
	return {
		loadSerapackFx: ({ packageId }: { readonly packageId: string }) =>
			Effect.suspend(() => {
				harness.loadedPackageIds.push(packageId);
				return harness.loadFailure === undefined
					? Effect.succeed({
							payload,
						})
					: Effect.fail(harness.loadFailure);
			}),
	};
});

const roots: Array<ReturnType<typeof createRoot>> = [];
const registries: AtomRegistry.AtomRegistry[] = [];

const PortraitProbe = () => {
	const result = useAtomValue(AboutPortraitImagesAtom);
	const urls = AsyncResult.isSuccess(result) ? result.value : [];
	return createElement("output", null, JSON.stringify(urls));
};

const mountProbe = async (registry: AtomRegistry.AtomRegistry) => {
	const container = document.createElement("div");
	document.body.append(container);
	const root = createRoot(container);
	roots.push(root);
	await act(async () => {
		root.render(
			createElement(
				RegistryContext.Provider,
				{
					value: registry,
				},
				createElement(PortraitProbe),
			),
		);
	});
	return container;
};

beforeEach(() => {
	harness.loadFailure = undefined;
	harness.loadedPackageIds.length = 0;
});

afterEach(async () => {
	await act(async () => {
		for (const root of roots.splice(0)) root.unmount();
	});
	for (const registry of registries.splice(0)) registry.dispose();
	document.body.replaceChildren();
});

describe("AboutPortraitImagesAtom", () => {
	it("loads installed portrait URLs in stable role order", async () => {
		const registry = AtomRegistry.make({
			defaultIdleTTL: 400,
			scheduleTask,
		});
		registries.push(registry);
		const container = await mountProbe(registry);

		await vi.waitFor(() =>
			expect(container.textContent).toBe(
				JSON.stringify([
					"serakki://game/resource/avatar-two",
					"serakki://game/resource/avatar-one",
					"serakki://game/resource/avatar-eight",
				]),
			),
		);
		expect(harness.loadedPackageIds).toEqual([
			SerakkiDefaultPackageId,
		]);
	});

	it("maps an ordinary load failure to the empty presentation", async () => {
		harness.loadFailure = new Error("portrait package unavailable");
		const registry = AtomRegistry.make({
			defaultIdleTTL: 400,
			scheduleTask,
		});
		registries.push(registry);
		const container = await mountProbe(registry);

		await vi.waitFor(() => {
			const result = registry.get(AboutPortraitImagesAtom);
			expect(AsyncResult.isSuccess(result) && !result.waiting).toBe(true);
		});
		expect(container.textContent).toBe("[]");
		expect(harness.loadedPackageIds).toEqual([
			SerakkiDefaultPackageId,
		]);
	});
});
