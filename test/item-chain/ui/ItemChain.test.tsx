// @vitest-environment jsdom
import { act, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";
import type { ItemSchema } from "~/item-definition/schema/ItemSchema";
import { catalogFn, clockFn, itemFn, mergeFn } from "../fn/readItemChainsFn.test/fixtures";

const state = vi.hoisted(() => ({
	items: {} as Record<string, ItemSchema.Type>,
}));
vi.mock("~/authoring-session/ui/useEditorProject", () => ({
	useEditorProject: () => ({
		projectId: "project",
		config: {
			items: state.items,
		},
	}),
}));
vi.mock("~/translation/ui/useTranslator", () => ({
	useTranslator: () => ({
		textFn: (label: string) => label,
	}),
}));
vi.mock("~/authoring-form/ui/EditorItemThumbnail", () => ({
	EditorItemThumbnail: () => null,
}));
vi.mock("~/ui/ui/Button", () => ({
	ButtonLink: ({ children }: { children: ReactNode }) => <span>{children}</span>,
}));
vi.mock("~/editor-control/ui/EditorSelect", () => ({
	EditorSelect: ({
		value,
		options,
		onChangeFn,
	}: {
		value: string;
		options: {
			value: string;
			label: string;
		}[];
		onChangeFn: (value: string) => void;
	}) => (
		<select
			value={value}
			onChange={(event) => onChangeFn(event.target.value)}
		>
			{options.map((option) => (
				<option
					key={option.value}
					value={option.value}
				>
					{option.label}
				</option>
			))}
		</select>
	),
}));
import { ItemChain } from "~/item-chain/ui/ItemChain";
(
	globalThis as {
		IS_REACT_ACT_ENVIRONMENT?: boolean;
	}
).IS_REACT_ACT_ENVIRONMENT = true;
const roots: ReturnType<typeof createRoot>[] = [];
afterEach(async () => {
	await act(async () => {
		for (const root of roots.splice(0)) root.unmount();
	});
	document.body.replaceChildren();
});

it("prunes and resumes a branch, then discards stale stops on a new project revision or root", async () => {
	state.items = catalogFn(
		itemFn("root", {
			merge: [
				mergeFn("target", "timed"),
			],
		}),
		itemFn("target"),
		itemFn("timed", {
			clock: clockFn("end"),
		}),
		itemFn("end"),
	);
	const container = document.createElement("div");
	document.body.append(container);
	const root = createRoot(container);
	roots.push(root);
	const renderFn = async (itemId = "root") =>
		act(async () => root.render(<ItemChain itemId={itemId} />));
	const resultsFn = () =>
		[
			...container.querySelectorAll('[data-ui="EditorChainOutcome"]'),
		].map((node) => node.textContent);
	const clickFn = async (label: string) =>
		act(async () => {
			const button = [
				...container.querySelectorAll("button"),
			].find((button) => button.textContent === label);
			expect(button).toBeDefined();
			button?.click();
		});
	await renderFn();
	expect(resultsFn().some((text) => text?.includes("end"))).toBe(true);
	await clickFn("Stop here");
	expect(resultsFn().some((text) => text?.includes("Stopped here"))).toBe(true);
	expect(resultsFn().some((text) => text?.includes("end"))).toBe(false);
	await clickFn("Continue branch");
	expect(resultsFn().some((text) => text?.includes("end"))).toBe(true);
	await clickFn("Stop here");
	state.items = {
		...state.items,
	};
	await renderFn();
	expect(resultsFn().some((text) => text?.includes("end"))).toBe(true);
	await clickFn("Stop here");
	await renderFn("timed");
	await renderFn();
	expect(resultsFn().some((text) => text?.includes("end"))).toBe(true);
});
