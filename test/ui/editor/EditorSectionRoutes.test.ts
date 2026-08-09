import { isRedirect } from "@tanstack/react-router";
import { describe, expect, it } from "vitest";

import { Route as ItemDetailSectionRoute } from "~/@routes/editor/$projectId/editor/items/$itemUid/detail/$sectionId";
import { Route as ItemFormSectionRoute } from "~/@routes/editor/$projectId/editor/items/$itemUid/form/$sectionId";
import { Route as ProjectSectionRoute } from "~/@routes/editor/$projectId/project/$sectionId";

type BeforeLoad = (input: { readonly params: Readonly<Record<string, string>> }) => unknown;

const readRedirect = (beforeLoad: BeforeLoad, params: Readonly<Record<string, string>>) => {
	try {
		beforeLoad({
			params,
		});
	} catch (error) {
		if (!isRedirect(error)) throw error;
		return error;
	}
	throw new Error("Expected route redirect.");
};

const readBeforeLoad = (route: {
	readonly options: {
		readonly beforeLoad?: unknown;
	};
}) => {
	if (typeof route.options.beforeLoad !== "function") {
		throw new Error("Route beforeLoad missing.");
	}
	return route.options.beforeLoad as BeforeLoad;
};

describe("editor section routes", () => {
	it("redirects a removed Project section to General without retaining the dead history leaf", () => {
		const redirect = readRedirect(readBeforeLoad(ProjectSectionRoute), {
			projectId: "project-test",
			sectionId: "board",
		});

		expect(redirect.options).toMatchObject({
			to: "/editor/$projectId/project/$sectionId",
			params: {
				projectId: "project-test",
				sectionId: "general",
			},
			replace: true,
		});
	});

	it("redirects unknown item detail sections to the canonical identity leaf", () => {
		const redirect = readRedirect(readBeforeLoad(ItemDetailSectionRoute), {
			projectId: "project-test",
			itemUid: "item-test",
			sectionId: "unknown",
		});

		expect(redirect.options).toMatchObject({
			to: "/editor/$projectId/editor/items/$itemUid/detail/$sectionId",
			params: {
				projectId: "project-test",
				itemUid: "item-test",
				sectionId: "identity",
			},
			replace: true,
		});
	});

	it("redirects unknown item form sections while preserving route-owned search", () => {
		const redirect = readRedirect(readBeforeLoad(ItemFormSectionRoute), {
			projectId: "project-test",
			itemUid: "item-test",
			sectionId: "unknown",
		});

		expect(redirect.options).toMatchObject({
			to: "/editor/$projectId/editor/items/$itemUid/form/$sectionId",
			params: {
				projectId: "project-test",
				itemUid: "item-test",
				sectionId: "identity",
			},
			search: true,
			replace: true,
		});
	});

	it("accepts valid direct section leaves without redirecting", () => {
		expect(() =>
			readBeforeLoad(ProjectSectionRoute)({
				params: {
					projectId: "project-test",
					sectionId: "appearance",
				},
			}),
		).not.toThrow();
		expect(() =>
			readBeforeLoad(ItemDetailSectionRoute)({
				params: {
					projectId: "project-test",
					itemUid: "item-test",
					sectionId: "flow",
				},
			}),
		).not.toThrow();
		expect(() =>
			readBeforeLoad(ItemFormSectionRoute)({
				params: {
					projectId: "project-test",
					itemUid: "item-test",
					sectionId: "production",
				},
			}),
		).not.toThrow();
	});
});
