// @vitest-environment jsdom

import { detectPlatform } from "@tanstack/react-hotkeys";
import type { Project } from "~/project-authoring/type/Project";
import { ItemSchema } from "~/item-definition/schema/ItemSchema";
import { act, createElement, type ButtonHTMLAttributes, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type MockButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
	readonly cursorIntent?: string;
};

vi.mock("@effect/atom-react", () => ({
	scheduleTask: vi.fn(),
	useAtomSet: () => state.saveItem,
	useAtomValue: () => state.canonical,
}));

vi.mock("@tanstack/react-router", async (importOriginal) => {
	const original = await importOriginal<typeof import("@tanstack/react-router")>();
	return {
		...original,
		useNavigate: () => state.navigate,
	};
});

vi.mock("~/ui/ui/LinkButton", async (importOriginal) => ({
	...(await importOriginal<typeof import("~/ui/ui/LinkButton")>()),
	LinkButtonLink: ({
		children,
		search,
	}: {
		readonly children?: ReactNode;
		readonly search?: unknown;
	}) =>
		createElement(
			"a",
			{
				"data-search": JSON.stringify(search),
			},
			children,
		),
}));

vi.mock("~/ui/ui/Button", () => ({
	Button: ({ children, cursorIntent: _cursorIntent, ...props }: MockButtonProps) =>
		createElement("button", props, children),
	PrimaryButton: ({ children, cursorIntent: _cursorIntent, ...props }: MockButtonProps) =>
		createElement("button", props, children),
}));

vi.mock("~/authoring-shell/ui/EditorHistoryBackButton", () => ({
	EditorHistoryBackButton: ({ children }: { readonly children?: ReactNode }) =>
		createElement("span", null, children),
}));

const state = vi.hoisted(() => ({
	canonical: undefined as unknown,
	navigate: vi.fn().mockResolvedValue(undefined),
	persisted: undefined as unknown,
	project: undefined as unknown,
	requestLeave: vi.fn().mockResolvedValue(true),
	saveItem: vi.fn(),
	unsavedSession: undefined as
		| {
				readonly saveFn: () => Promise<boolean>;
				readonly discardFn: () => void;
				readonly isDirtyFn: () => boolean;
		  }
		| undefined,
}));

vi.mock("~/authoring-session/ui/useEditorUnsavedChangesRegistration", () => ({
	useEditorUnsavedChangesRegistration: (session: typeof state.unsavedSession) => {
		state.unsavedSession = session;
	},
	useEditorUnsavedChangesOwner: () => ({
		requestLeaveFn: async (pathname: string) => {
			const allowed = await state.requestLeave(pathname);
			if (allowed && state.unsavedSession?.isDirtyFn()) state.unsavedSession.discardFn();
			return allowed;
		},
	}),
}));

vi.mock("~/authoring-session/ui/useEditorProject", () => ({
	useEditorProject: () => state.project,
}));

vi.mock("~/item-authoring/ui/useItemByUid", () => ({
	useItemByUid: () => state.persisted,
}));

vi.mock("~/authoring-form/ui/ResourceAutocompleteField", () => ({
	ResourceReferenceControl: ({
		label,
		value,
		onChangeFn,
	}: {
		readonly label: string;
		readonly value: string;
		readonly onChangeFn: (value: string) => void;
	}) =>
		createElement("input", {
			"data-resource-label": label,
			value,
			onChange: (event: React.ChangeEvent<HTMLInputElement>) =>
				onChangeFn(event.target.value),
		}),
	ResourceAutocompleteField: ({ label }: { readonly label: string }) =>
		createElement("span", null, label),
}));

vi.mock("~/authoring-form/ui/EditorItemAutocompleteField", () => ({
	EditorItemAutocompleteField: ({ label }: { readonly label: string }) =>
		createElement("span", null, label),
	EditorItemReferenceControl: ({
		error,
		label,
	}: {
		readonly error?: string;
		readonly label: string;
	}) =>
		createElement(
			"label",
			null,
			label,
			createElement("input", {
				"data-ui-invalid": error === undefined ? undefined : "true",
			}),
			error === undefined ? null : createElement("span", null, error),
		),
}));
import { Form } from "~/item-authoring/ui/Form";
import { ProjectResourceUrlProvider } from "~/authoring-session/ui/ResourceUrlSession";
import { ArtworkSection } from "~/item-authoring/ui/ArtworkSection";
import { useFormSession } from "~/item-authoring/ui/FormContext";
import { IdentitySection } from "~/item-authoring/ui/IdentitySection";
import { ClockSection } from "~/item-authoring/ui/ClockSection";
import { UnitsSection } from "~/item-authoring/ui/UnitsSection";
import { MergesSection } from "~/item-authoring/ui/MergesSection";
import { ProductionSection } from "~/item-authoring/ui/ProductionSection";
import type { OptionalCapability, SectionId } from "~/item-authoring/type/Section";
import {
	createLine,
	createOutput,
	createExpiryLine,
	createProducerItem,
} from "~test/game-config-validation/support/gameValidationTestSource";

(
	globalThis as {
		IS_REACT_ACT_ENVIRONMENT?: boolean;
	}
).IS_REACT_ACT_ENVIRONMENT = true;

const roots: Array<ReturnType<typeof createRoot>> = [];
const item: ItemSchema.Type = {
	maxQueueSize: 1,
	ui: "default",
	lines: [],

	uid: "item:water",

	title: "Water",
	description: "Fresh water.",
	artwork: {
		scale: 0.8,
		default: [
			"artwork:water",
		],
	},
};

beforeEach(() => {
	vi.clearAllMocks();
	state.canonical = {
		config: {
			meta: {
				id: "editor-test",
				title: "Editor test",
				board: {
					width: 2,
					height: 2,
				},
			},
			resources: {
				hero: "hero",
			},
			start: {
				currentSpace: 0,
				spaces: [],
			},
			items: {
				[item.uid]: item,
			},
		},
	};
	state.project = {
		projectId: "editor-test",
		revision: "revision-1",
		version: {
			major: 1,
			minor: 0,
		},
		resources: [],
		config: (
			state.canonical as {
				config: unknown;
			}
		).config,
	};
	state.persisted = item;
	state.saveItem.mockResolvedValue(item);
	state.requestLeave.mockReset().mockResolvedValue(true);
	state.unsavedSession = undefined;
});

afterEach(async () => {
	await act(async () => {
		for (const root of roots.splice(0)) root.unmount();
	});
	document.body.replaceChildren();
});

const render = async (
	children: ReactNode,
	newItem = false,
	enableCapability?: OptionalCapability,
	productionLine?: {
		readonly uid: string;
	},
) => {
	const container = document.createElement("div");
	document.body.append(container);
	const root = createRoot(container);
	roots.push(root);
	const renderSection = async (section: ReactNode, sectionId: SectionId = "identity") => {
		await act(async () => {
			root.render(
				<Form
					{...(newItem
						? {
								defaultTitle: "Dirty Bucket",
								create: true as const,
							}
						: {})}
					sectionId={sectionId}
					enableCapability={enableCapability}
					productionLineUid={productionLine?.uid}
					uid={item.uid}
				>
					{section}
				</Form>,
			);
		});
	};
	await renderSection(children);
	return {
		container,
		renderSection,
	};
};

const changeInput = async (input: HTMLInputElement, value: string) => {
	const valueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
	if (valueSetter === undefined) throw new Error("Expected native input value setter.");
	await act(async () => {
		valueSetter.call(input, value);
		input.dispatchEvent(
			new Event("input", {
				bubbles: true,
			}),
		);
	});
};

const changeTextArea = async (input: HTMLTextAreaElement, value: string) => {
	const valueSetter = Object.getOwnPropertyDescriptor(
		HTMLTextAreaElement.prototype,
		"value",
	)?.set;
	if (valueSetter === undefined) throw new Error("Expected native textarea value setter.");
	await act(async () => {
		valueSetter.call(input, value);
		input.dispatchEvent(
			new Event("input", {
				bubbles: true,
			}),
		);
	});
};

const completeFirstProductionLine = async (container: HTMLElement) => {
	const title = container.querySelector<HTMLInputElement>('input[name="lines[0].title"]');
	const description = container.querySelector<HTMLTextAreaElement>(
		'textarea[name="lines[0].description"]',
	);
	if (title === null || description === null)
		throw new Error("Missing new production line identity fields.");
	await changeInput(title, "Test production line");
	await changeTextArea(description, "Produces the test outcome.");
};

describe("item section form session", () => {
	it("saves multiline keyword edits and clears them without changing Description", async () => {
		state.saveItem.mockImplementation(async ({ item: saved }) => {
			state.persisted = saved;
			return saved;
		});
		const { container, renderSection } = await render(<IdentitySection />);
		const keywords = container.querySelector<HTMLTextAreaElement>('textarea[name="keywords"]');
		if (keywords === null) throw new Error("Missing Keywords field");
		const saveButton = [
			...container.querySelectorAll("button"),
		].find((button) => button.textContent === "Save");
		if (saveButton === undefined) throw new Error("Missing Save action");
		await changeTextArea(keywords, "  currency\ncoins money  ");
		await act(async () => saveButton.click());
		expect(state.saveItem.mock.lastCall?.[0].item).toMatchObject({
			keywords: "currency\ncoins money",
			description: item.description,
		});
		await renderSection(<IdentitySection />);
		expect(keywords.value).toBe("currency\ncoins money");
		await changeTextArea(keywords, "   ");
		await act(async () => saveButton.click());
		expect(state.saveItem.mock.lastCall?.[0].item).not.toHaveProperty("keywords");
		expect(state.saveItem.mock.lastCall?.[0].item.description).toBe(item.description);
	});

	it("renders artwork on direct Clock entry and follows unsaved overlay changes", async () => {
		state.project = {
			...(state.project as Project),
			resources: [
				"artwork:water",
				"artwork:overlay",
			].map((uid) => ({
				uid,
				title: uid,
				type: "artwork" as const,
				size: 1,
				version: "1",
			})),
		};
		const ArtworkEditProbe = () => {
			const { form } = useFormSession();
			return (
				<button
					type="button"
					onClick={() =>
						form.setFieldValue(
							"artwork.default[1]",
							form.state.values.artwork.default[1] === "" ? "artwork:overlay" : "",
						)
					}
				>
					Toggle overlay
				</button>
			);
		};
		const container = document.createElement("div");
		document.body.append(container);
		const root = createRoot(container);
		roots.push(root);
		await act(async () => {
			root.render(
				<ProjectResourceUrlProvider>
					<Form
						uid={item.uid}
						sectionId="clock"
					>
						<ArtworkEditProbe />
					</Form>
				</ProjectResourceUrlProvider>,
			);
		});
		const headerResourcesFn = () =>
			Array.from(
				container.querySelectorAll<HTMLImageElement>(
					'[data-ui="EditorItemHeaderTitle"] img',
				),
				(image) => new URL(image.src).searchParams.get("resourceUid"),
			);
		expect(headerResourcesFn()).toEqual([
			"artwork:water",
		]);
		const toggle = Array.from(container.querySelectorAll("button")).find(
			(button) => button.textContent === "Toggle overlay",
		);
		if (toggle === undefined) throw new Error("Missing artwork edit probe.");
		await act(async () => toggle.click());
		expect(headerResourcesFn()).toEqual([
			"artwork:water",
			"artwork:overlay",
		]);
		await act(async () => toggle.click());
		expect(headerResourcesFn()).toEqual([
			"artwork:water",
		]);
		expect(state.saveItem).not.toHaveBeenCalled();
	});

	it("returns to the current section after shortcut Save and Discard", async () => {
		const { container, renderSection } = await render(<IdentitySection />);
		await renderSection(<IdentitySection />, "clock");
		const title = container.querySelector<HTMLInputElement>('input[name="title"]');
		if (title === null) throw new Error("Missing title input");
		await changeInput(title, "Changed");
		const buttonFn = (label: string) =>
			[
				...container.querySelectorAll("button"),
			].find((button) => button.textContent === label);
		await act(async () => {
			title.dispatchEvent(
				new KeyboardEvent("keydown", {
					key: "s",
					code: "KeyS",
					bubbles: true,
					cancelable: true,
					metaKey: detectPlatform() === "mac",
					ctrlKey: detectPlatform() !== "mac",
				}),
			);
		});
		expect(state.navigate).toHaveBeenLastCalledWith(
			expect.objectContaining({
				to: "/editor/$projectId/editor/items/$itemUid/detail/$sectionId",
				params: expect.objectContaining({
					sectionId: "clock",
				}),
			}),
		);
		const saves = state.saveItem.mock.calls.length;
		state.navigate.mockClear();
		await changeInput(title, "Discarded");
		await act(async () => {
			buttonFn("Discard")?.click();
		});
		expect(state.navigate).toHaveBeenCalledTimes(1);
		expect(state.navigate).toHaveBeenLastCalledWith(
			expect.objectContaining({
				params: expect.objectContaining({
					sectionId: "clock",
				}),
			}),
		);
		expect(state.saveItem).toHaveBeenCalledTimes(saves);
	});
	it.each([
		"production",
	] as const)("keeps the detail %s enable intent local until Save", async (capability) => {
		const configured = ItemSchema.parse({
			...item,
			lines: [],
		});
		state.persisted = configured;
		(state.project as Project).config.items[item.uid] = configured;
		const { container, renderSection } = await render(<IdentitySection />, false, capability);
		expect(state.saveItem).not.toHaveBeenCalled();
		if (capability === "production") {
			await renderSection(<ProductionSection />, "production");
			await completeFirstProductionLine(container);
		}
		await act(async () => {
			[
				...container.querySelectorAll("button"),
			]
				.find((button) => button.textContent === "Save")
				?.click();
		});
		const saved = state.saveItem.mock.lastCall?.[0].item;
		expect(saved.lines).toHaveLength(1);
	});

	it("keeps an asset-origin draft seed in routed section links", async () => {
		state.persisted = undefined;
		const { container } = await render(<IdentitySection />, true);
		const title = container.querySelector<HTMLInputElement>('input[name="title"]');
		if (title === null) throw new Error("Missing seeded title field");
		expect(title.value).toBe("Dirty Bucket");
		await changeInput(title, "Washed Bucket");
		expect(state.saveItem).not.toHaveBeenCalled();
		const artworkLink = [
			...container.querySelectorAll<HTMLAnchorElement>("a"),
		].find((link) => link.textContent === "Artwork");
		if (artworkLink === undefined) throw new Error("Missing Artwork section link.");

		expect(JSON.parse(artworkLink.dataset.search ?? "null")).toMatchObject({
			defaultTitle: "Dirty Bucket",
			create: true,
		});
	});

	it("saves a valid untouched new item draft", async () => {
		state.persisted = undefined;
		state.saveItem.mockImplementation(async ({ item: saved }) => saved);
		const { container } = await render(<IdentitySection />, true);
		const saveButton = [
			...container.querySelectorAll("button"),
		].find((button) => button.textContent === "Save");
		if (saveButton === undefined) throw new Error("Missing item Save action.");

		expect(saveButton.disabled).toBe(false);
		await act(async () => {
			saveButton.click();
			await Promise.resolve();
		});

		expect(state.saveItem).toHaveBeenCalledWith(
			expect.objectContaining({
				item: expect.objectContaining({
					uid: item.uid,
					title: "Dirty Bucket",
				}),
			}),
		);
		expect(state.navigate).toHaveBeenCalledOnce();
	});

	it("locks the item draft for the pending save snapshot and unlocks after failure", async () => {
		let rejectSave!: (cause: Error) => void;
		state.saveItem.mockImplementationOnce(
			() =>
				new Promise((_resolve, reject) => {
					rejectSave = reject;
				}),
		);
		const { container } = await render(<IdentitySection />);
		const title = container.querySelector<HTMLInputElement>('input[name="title"]');
		if (title === null) throw new Error("Missing title input.");
		await changeInput(title, "Pending item title");
		const save = [
			...container.querySelectorAll("button"),
		].find((button) => button.textContent === "Save");
		await act(async () => save?.click());
		expect(state.saveItem).toHaveBeenCalledOnce();
		expect(title.matches(":disabled")).toBe(true);
		expect(state.saveItem.mock.calls[0]?.[0].item.title).toBe("Pending item title");
		await act(async () => rejectSave(new Error("Save failed")));
		expect(title.matches(":disabled")).toBe(false);
		expect(title.value).toBe("Pending item title");
		expect(state.navigate).not.toHaveBeenCalled();
		state.navigate.mockImplementationOnce(() => new Promise<void>(() => undefined));
		await changeInput(title, "Retry item title");
		await act(async () => save?.click());
		expect(state.saveItem).toHaveBeenLastCalledWith(
			expect.objectContaining({
				item: expect.objectContaining({
					title: "Retry item title",
				}),
			}),
		);
		expect(state.navigate).toHaveBeenCalledOnce();
		expect(title.matches(":disabled")).toBe(false);
	});

	it("keeps the persisted artwork scale in the form and saves the edited ratio", async () => {
		const scaledItem = {
			...item,
			artwork: {
				...item.artwork,
				scale: 0.65,
			},
		};
		state.persisted = scaledItem;
		const { container } = await render(<ArtworkSection />);
		const scale = container.querySelector<HTMLInputElement>('input[name="artwork.scale"]');
		if (scale === null) throw new Error("Missing artwork scale control.");
		expect(scale.value).toBe("0.65");
		await changeInput(scale, "0.9");
		await act(async () => {
			await state.unsavedSession?.saveFn();
		});
		expect(state.saveItem).toHaveBeenCalledOnce();
		expect(state.saveItem.mock.calls[0]?.[0].item.artwork).toEqual({
			...item.artwork,
			scale: 0.9,
		});
		expect(scaledItem.artwork.scale).toBe(0.65);
	});

	it("keeps the unsaved-leave Save persistence-only while ordinary Save owns navigation", async () => {
		const { container } = await render(<IdentitySection />);
		const title = container.querySelector<HTMLInputElement>('input[name="title"]');
		if (title === null || state.unsavedSession === undefined)
			throw new Error("Missing item form.");

		await changeInput(title, "Saved without leaving");
		await act(async () => {
			await state.unsavedSession?.saveFn();
		});
		expect(state.saveItem).toHaveBeenCalledOnce();
		expect(state.navigate).not.toHaveBeenCalled();

		await changeInput(title, "Saved and leave");
		const saveButton = [
			...container.querySelectorAll("button"),
		].find((button) => button.textContent === "Save");
		await act(async () => {
			saveButton?.click();
			await Promise.resolve();
		});
		expect(state.saveItem).toHaveBeenCalledTimes(2);
		expect(state.saveItem).toHaveBeenLastCalledWith(
			expect.objectContaining({
				item: expect.objectContaining({
					uid: item.uid,
					title: "Saved and leave",
				}),
			}),
		);
		expect(state.navigate).toHaveBeenCalledOnce();
	});

	it("discards the local draft and returns an existing item to detail without saving", async () => {
		const { container } = await render(<IdentitySection />);
		const title = container.querySelector<HTMLInputElement>('input[name="title"]');
		if (title === null) throw new Error("Missing item title input.");

		await changeInput(title, "Discarded title");
		const discardButton = [
			...container.querySelectorAll("button"),
		].find((button) => button.textContent === "Discard");
		if (discardButton === undefined) throw new Error("Missing item Discard action.");
		await act(async () => {
			discardButton.click();
			await Promise.resolve();
		});

		expect(title.value).toBe("Water");
		expect(state.saveItem).not.toHaveBeenCalled();
		expect(state.navigate).toHaveBeenCalledWith({
			to: "/editor/$projectId/editor/items/$itemUid/detail/$sectionId",
			params: {
				projectId: "editor-test",
				itemUid: item.uid,
				sectionId: "identity",
			},
			replace: true,
		});
	});

	it("keeps a dirty item form mounted when Discard is canceled", async () => {
		const { container } = await render(<IdentitySection />);
		const title = container.querySelector<HTMLInputElement>('input[name="title"]');
		if (title === null) throw new Error("Missing item title input.");
		await changeInput(title, "Keep this title");
		state.requestLeave.mockResolvedValueOnce(false);

		await act(async () => {
			[
				...container.querySelectorAll("button"),
			]
				.find((button) => button.textContent === "Discard")
				?.click();
			await Promise.resolve();
		});

		expect(state.requestLeave).toHaveBeenCalledWith(
			`/editor/editor-test/editor/items/${item.uid}/detail/identity`,
		);
		expect(title.value).toBe("Keep this title");
		expect(state.navigate).not.toHaveBeenCalled();
	});

	it("retains the local draft across routed section replacement", async () => {
		const { container, renderSection } = await render(<IdentitySection />);
		const title = container.querySelector<HTMLInputElement>('input[name="title"]');
		if (title === null) throw new Error("Missing item title input.");

		await changeInput(title, "Changed water");
		await act(async () =>
			document.body.dispatchEvent(
				new KeyboardEvent("keydown", {
					key: "a",
					bubbles: true,
					cancelable: true,
				}),
			),
		);
		expect(state.navigate).toHaveBeenLastCalledWith(
			expect.objectContaining({
				to: "/editor/$projectId/editor/items/$itemUid/form/$sectionId",
				params: {
					projectId: "editor-test",
					itemUid: item.uid,
					sectionId: "artwork",
				},
			}),
		);
		expect(state.saveItem).not.toHaveBeenCalled();
		expect(state.requestLeave).not.toHaveBeenCalled();
		await renderSection(<div>Artwork section</div>, "artwork");
		await renderSection(<IdentitySection />, "identity");

		expect(container.querySelector<HTMLInputElement>('input[name="title"]')?.value).toBe(
			"Changed water",
		);
	});

	it("keeps the invalid merge selected when validation returns to its section", async () => {
		const itemWithMerges: ItemSchema.Type = {
			...item,
			merge: [
				{
					action: "consume",
					effect: "keep",
					target: {
						itemUid: item.uid,
						type: "item",
					},
				},
				{
					action: "use",
					effect: "remove",
					target: {
						itemUid: item.uid,
						type: "item",
					},
				},
			],
		};
		state.persisted = itemWithMerges;
		(
			state.canonical as {
				config: {
					items: Record<string, ItemSchema.Type>;
				};
			}
		).config.items[item.uid] = itemWithMerges;
		const InvalidMergeProbe = () => {
			const { form } = useFormSession();
			return (
				<button
					type="button"
					onClick={() => form.setFieldValue("merge[1].target.itemUid", "")}
				>
					Invalidate second merge
				</button>
			);
		};
		const { container } = await render(<InvalidMergeProbe />);

		await act(async () => {
			[
				...container.querySelectorAll("button"),
			]
				.find((button) => button.textContent === "Invalidate second merge")
				?.click();
		});
		const saveButton = [
			...container.querySelectorAll("button"),
		].find((button) => button.textContent === "Save");
		await act(async () => {
			saveButton?.click();
			await Promise.resolve();
		});

		expect(state.saveItem).not.toHaveBeenCalled();
		expect(state.navigate).toHaveBeenCalledWith({
			to: "/editor/$projectId/editor/items/$itemUid/form/$sectionId",
			params: {
				projectId: "editor-test",
				itemUid: item.uid,
				sectionId: "merges",
			},
			search: {
				merge: 1,
			},
		});
	});

	it("selects and focuses the exact invalid control inside a nested outcome", async () => {
		const producerBase = createProducerItem({
			id: "producer",
			outcome: createOutput([
				{
					itemUid: item.uid,
				},
			]),
		});
		const producer = {
			...producerBase,
			lines: producerBase.lines?.map((line) => ({
				...line,
				rules: [
					{
						type: "show" as const,
						when: [
							{
								type: "exists" as const,
								query: {
									distance: "far",
									selector: {
										type: "item" as const,
										itemUid: item.uid,
									},
								},
							},
						],
					},
					{
						type: "show" as const,
						when: [
							{
								type: "exists" as const,
								query: {
									distance: "far",
									selector: {
										type: "item" as const,
										itemUid: "",
									},
								},
							},
						],
					},
				],
			})),
		} as ItemSchema.Type;
		state.persisted = producer;
		const config = (
			state.project as {
				config: {
					items: Record<string, ItemSchema.Type>;
				};
			}
		).config;
		config.items = {
			[item.uid]: item,
			[producer.uid]: producer,
		};
		const { container } = await render(<ProductionSection />);
		const addOutputSet = container.querySelector<HTMLButtonElement>(
			'[data-ui="EditorOutcomeSetsCollection"] [data-ui="EditorCollectionAdd"]',
		);
		const saveButton = [
			...container.querySelectorAll("button"),
		].find((button) => button.textContent === "Save");
		if (addOutputSet === null || saveButton === undefined)
			throw new Error("Missing nested outcome controls.");

		await act(async () => addOutputSet.click());
		const addRoll = container.querySelector<HTMLButtonElement>(
			'[data-ui="EditorRollsCollection"] [data-ui="EditorCollectionAdd"]',
		);
		if (addRoll === null) throw new Error("Missing add roll control.");
		await act(async () => addRoll.click());
		const guaranteed = document.querySelector<HTMLButtonElement>(
			'[data-ui="ActionMenuOption"][data-ui-id="guaranteed"]',
		);
		if (guaranteed === null) throw new Error("Missing Guaranteed roll option.");
		await act(async () => guaranteed.click());
		const addDrop = container.querySelector<HTMLButtonElement>(
			'[data-ui="EditorOutcomesCollection"] [data-ui="EditorCollectionAdd"]',
		);
		if (addDrop === null) throw new Error("Missing add drop control.");
		await act(async () => {
			saveButton.click();
			await Promise.resolve();
		});
		const emptyOutcomes = container.querySelector<HTMLInputElement>(
			'input[placeholder="Search outcomes…"]',
		);
		expect(emptyOutcomes?.disabled).toBe(true);
		expect(emptyOutcomes?.dataset.uiInvalid).toBe("true");
		expect(emptyOutcomes?.closest("label")?.textContent).toContain("Add at least one outcome.");
		const selectedCollectionLabels = Array.from(
			container.querySelectorAll<HTMLInputElement>("input"),
		).map((input) => input.value);
		expect(selectedCollectionLabels).toContain("Rule 1 — Show");
		expect(selectedCollectionLabels).not.toContain("Rule 2 — Show");
		expect(container.textContent).not.toContain("Select an item.");

		await act(async () => addDrop.click());
		const itemOutcome = document.querySelector<HTMLButtonElement>(
			'[data-ui="ActionMenuOption"][data-ui-id="drop-local"]',
		);
		if (itemOutcome === null) throw new Error("Missing local drop outcome option.");
		await act(async () => itemOutcome.click());
		await act(async () => {
			saveButton.click();
			await Promise.resolve();
		});

		const invalid = container.querySelector<HTMLInputElement>('input[data-ui-invalid="true"]');
		expect(invalid?.closest("label")?.textContent).toContain("Select an item.");
		await act(
			() =>
				new Promise<void>((resolve) => {
					requestAnimationFrame(() => resolve());
				}),
		);
		expect(document.activeElement).toBe(invalid);
	});

	it.each([
		"merges",
		"production",
		"clock",
		"units",
	] as const)(
		"disables all %s only in the draft until Save and preserves the other capabilities",
		async (capability) => {
			const configured = ItemSchema.parse({
				...item,
				maxQueueSize: 4,
				units: {
					amount: 3,
				},
				clock: {
					intervalMs: 1500,
					durationMs: 2000,
				},
				lines: [
					createLine({
						uid: "line:first",
					}),
					createLine({
						uid: "line:second",
					}),
				],
				merge: [
					{
						action: "consume",
						effect: "keep",
						target: {
							type: "item",
							itemUid: item.uid,
						},
					},
					{
						action: "use",
						effect: "remove",
						target: {
							type: "item",
							itemUid: item.uid,
						},
					},
				],
			});
			state.persisted = configured;
			(state.project as Project).config.items[item.uid] = configured;
			const section = {
				merges: <MergesSection />,
				production: <ProductionSection />,
				clock: <ClockSection />,
				units: <UnitsSection />,
			}[capability];
			const { container, renderSection } = await render(section);
			await renderSection(section, capability);
			const disable = container.querySelector<HTMLButtonElement>(
				'[data-ui="EditorSectionBar"] [data-ui="ItemSectionDisableControl"]',
			);
			if (disable === null) throw new Error("Missing disable capability control.");
			await act(async () => disable.click());
			expect(state.saveItem).not.toHaveBeenCalled();
			expect(state.persisted).toBe(configured);
			await act(async () => {
				await state.unsavedSession?.saveFn();
			});
			expect(state.saveItem).toHaveBeenLastCalledWith(
				expect.objectContaining({
					item: expect.objectContaining({
						uid: configured.uid,
						maxQueueSize: configured.maxQueueSize,
						clock: capability === "clock" ? undefined : configured.clock,
						units: capability === "units" ? undefined : configured.units,
						lines: capability === "production" ? [] : configured.lines,
						merge: capability === "merges" ? undefined : configured.merge,
					}),
				}),
			);
		},
	);

	it("adds production to a passive Common through the ordinary line editor", async () => {
		const { container } = await render(<ProductionSection />);
		const addLine = container.querySelector<HTMLButtonElement>(
			'[data-ui="EditorProductionLinesCollection"] [data-ui="EditorCollectionAdd"]',
		);
		if (addLine === null) throw new Error("Missing add production line control.");
		await act(async () => addLine.click());
		expect(
			container.querySelector<HTMLInputElement>('[data-ui="EditorInputsCollection"] input')
				?.value,
		).toBe("");
		expect(
			container.querySelector<HTMLButtonElement>(
				'[data-ui="EditorInputsCollection"] [data-ui="EditorCollectionRemove"]',
			)?.disabled,
		).toBe(true);
		await completeFirstProductionLine(container);
		await act(async () => {
			await state.unsavedSession?.saveFn();
		});
		expect(state.saveItem).toHaveBeenLastCalledWith(
			expect.objectContaining({
				item: expect.objectContaining({
					lines: [
						expect.objectContaining({
							default: true,
						}),
					],
				}),
			}),
		);
	});
	it("saves a passive Common after removing its last production line", async () => {
		const common = {
			...createProducerItem({
				id: item.uid,
			}),
			uid: item.uid,
		};
		state.persisted = common;
		(state.project as Project).config.items[item.uid] = common;
		const { container } = await render(<ProductionSection />);
		const removeLine = container.querySelector<HTMLButtonElement>(
			'[data-ui="EditorProductionLinesCollection"] [data-ui="EditorCollectionRemove"]',
		);
		if (removeLine === null) throw new Error("Missing remove line control.");
		await act(async () => removeLine.click());
		await act(async () => {
			await state.unsavedSession?.saveFn();
		});
		expect(state.saveItem).toHaveBeenLastCalledWith(
			expect.objectContaining({
				item: expect.objectContaining({
					lines: [],
				}),
			}),
		);
	});

	it("saves and clears optional line artwork without changing the owning item's artwork", async () => {
		state.saveItem.mockImplementation(async ({ item }: { item: ItemSchema.Type }) => {
			state.persisted = item;
			(state.project as Project).config.items[item.uid] = item;
			return item;
		});
		const common = {
			...createProducerItem({
				id: item.uid,
			}),
			uid: item.uid,
		};
		state.persisted = common;
		(state.project as Project).config.items[item.uid] = common;
		const { container, renderSection } = await render(<ProductionSection />);
		const artwork = container.querySelector<HTMLInputElement>(
			'input[data-resource-label="Artwork"]',
		);
		if (artwork === null) throw new Error("Missing line artwork control.");
		await changeInput(artwork, "line-artwork");
		await act(async () => {
			await state.unsavedSession?.saveFn();
		});
		expect(state.saveItem.mock.lastCall?.[0].item.lines[0].artwork).toBe("line-artwork");
		expect(state.saveItem.mock.lastCall?.[0].item.artwork).toEqual(common.artwork);
		await renderSection(<ProductionSection />);
		const savedArtwork = container.querySelector<HTMLInputElement>(
			'input[data-resource-label="Artwork"]',
		);
		if (savedArtwork === null) throw new Error("Missing saved line artwork control.");
		await changeInput(savedArtwork, "");
		await act(async () => {
			await state.unsavedSession?.saveFn();
		});
		expect(
			JSON.parse(JSON.stringify(state.saveItem.mock.lastCall?.[0].item)).lines[0],
		).not.toHaveProperty("artwork");
	});

	it("opens the exact graph line by immutable UID independently of its siblings", async () => {
		const common = {
			...createProducerItem({
				id: item.uid,
				lines: [
					{
						...createLine({
							uid: "first-line",
						}),
						title: "First",
					},
					{
						...createLine({
							uid: "second-line",
						}),
						title: "Second",
					},
				],
			}),
			uid: item.uid,
		};
		state.persisted = common;
		(state.project as Project).config.items[item.uid] = common;
		const { container } = await render(<ProductionSection />, false, undefined, {
			uid: "second-line",
		});
		expect(
			container.querySelector<HTMLInputElement>('input[name="lines[1].title"]')?.value,
		).toBe("Second");
		expect(container.querySelector('input[name="lines[0].title"]')).toBeNull();
	});

	it("preserves the immutable line UID when its title changes", async () => {
		const sibling = createLine({
			uid: "line:second",
		});
		const common = {
			...createProducerItem({
				id: item.uid,
				lines: [
					{
						...createLine({
							uid: "custom-id",
						}),
						title: "Original Title",
					},
					sibling,
				],
			}),
			uid: item.uid,
		};
		state.persisted = common;
		(state.project as Project).config.items[item.uid] = common;
		const { container } = await render(<ProductionSection />);
		const title = container.querySelector<HTMLInputElement>('input[name="lines[0].title"]');
		if (title === null) throw new Error("Missing line title field.");
		await changeInput(title, "Next Title");
		await act(async () => {
			await state.unsavedSession?.saveFn();
		});
		expect(state.saveItem.mock.lastCall?.[0].item.lines).toEqual([
			{
				...common.lines[0],
				title: "Next Title",
			},
			sibling,
		]);
	});

	it("separates manual and Clock line editing without changing their shared form order", async () => {
		state.saveItem.mockImplementation(async ({ item }: { item: ItemSchema.Type }) => {
			state.persisted = item;
			(state.project as Project).config.items[item.uid] = item;
			return item;
		});
		const common = ItemSchema.parse({
			...createProducerItem({
				id: item.uid,
			}),
			uid: item.uid,
			clock: {
				intervalMs: 5000,
				durationMs: 10000,
			},
			lines: [
				createLine({
					uid: "line:first",
					default: true,
				}),
				createLine({
					uid: "line:second",
					default: false,
					trigger: "clock-interval",
				}),
			],
		});
		state.persisted = common;
		(state.project as Project).config.items[item.uid] = common;
		const { container, renderSection } = await render(<ProductionSection />);
		expect(container.querySelector('input[name="lines[0].title"]')).not.toBeNull();
		expect(container.querySelector('input[name="lines[1].title"]')).toBeNull();
		expect(container.querySelector('input[name="lines[0].weight"]')).toBeNull();
		await renderSection(<ClockSection />, "clock");
		expect(container.querySelector('input[name="lines[0].title"]')).toBeNull();
		expect(container.querySelector('input[name="lines[1].title"]')).not.toBeNull();
		const clockTitle = container.querySelector<HTMLInputElement>(
			'input[name="lines[1].title"]',
		);
		if (clockTitle === null) throw new Error("Missing Clock line title field.");
		await changeInput(clockTitle, "");
		await act(async () => {
			await state.unsavedSession?.saveFn();
		});
		expect(state.navigate).toHaveBeenLastCalledWith(
			expect.objectContaining({
				params: expect.objectContaining({
					sectionId: "clock",
				}),
			}),
		);
		await changeInput(clockTitle, common.lines[1].title);
		const weight = container.querySelector<HTMLInputElement>('input[name="lines[1].weight"]');
		if (weight === null) throw new Error("Missing line weight field.");
		await changeInput(weight, "7");
		await act(async () => {
			await state.unsavedSession?.saveFn();
		});
		expect(state.saveItem.mock.lastCall?.[0].item.lines[0].clock).toBeUndefined();
		expect(state.saveItem.mock.lastCall?.[0].item.lines[1].weight).toBe(7);
		await renderSection(<ClockSection />, "clock");
		const remove = container.querySelector<HTMLButtonElement>(
			'[data-ui="EditorClockLinesCollection"] [data-ui="EditorCollectionRemove"]',
		);
		if (remove === null) throw new Error("Missing Clock line remove control.");
		await act(async () => remove.click());
		await act(async () => {
			await state.unsavedSession?.saveFn();
		});
		expect(
			state.saveItem.mock.lastCall?.[0].item.lines.map(
				(line: ItemSchema.Type["lines"][number]) => line.uid,
			),
		).toEqual([
			"line:first",
		]);
	});

	it("creates an interval line in Clock without a manual Default", async () => {
		let session: ReturnType<typeof useFormSession> | undefined;
		const Probe = () => {
			session = useFormSession();
			return <ClockSection />;
		};
		const scheduled = ItemSchema.parse({
			...item,
			clock: {
				intervalMs: 5000,
				durationMs: 10000,
			},
		});
		state.persisted = scheduled;
		(state.project as Project).config.items[item.uid] = scheduled;
		const { container } = await render(<Probe />);
		const add = container.querySelector<HTMLButtonElement>(
			'[data-ui="EditorClockLinesCollection"] [data-ui="EditorCollectionAdd"]',
		);
		if (add === null) throw new Error("Missing Clock line add control.");
		await act(async () => add.click());
		const intervalOption = document.querySelector<HTMLButtonElement>(
			'[data-ui="ActionMenuOption"][data-ui-id="clock-interval"]',
		);
		if (intervalOption === null) throw new Error("Missing interval option.");
		await act(async () => intervalOption.click());
		expect(
			session?.form.state.values.lines?.map((line) => [
				line.trigger,
				line.default,
			]),
		).toEqual([
			[
				"clock-interval",
				false,
			],
		]);
	});

	it.each([
		"form",
		"detail",
	] as const)("enables a clock through the %s entry as one valid saved item", async (entry) => {
		const common = {
			...item,
		};
		state.persisted = common;
		(state.project as Project).config.items[item.uid] = common;
		const { container } = await render(
			<ClockSection />,
			false,
			entry === "detail" ? "clock" : undefined,
		);
		if (entry === "form") {
			const enable = [
				...container.querySelectorAll("button"),
			].find((button) => button.textContent === "Enable");
			if (enable === undefined) throw new Error("Missing clock enable control.");
			await act(async () => enable.click());
		}
		expect(state.saveItem).not.toHaveBeenCalled();
		await act(async () => {
			await state.unsavedSession?.saveFn();
		});
		expect(state.saveItem.mock.lastCall?.[0].item).toMatchObject({
			clock: {
				durationMs: 900_000,
			},
			lines: [],
		});
		expect(state.saveItem.mock.lastCall?.[0].item.clock.intervalMs).toBeUndefined();
	});

	it("saves a Clock with a cleared optional lifetime while retaining its interval and production lines", async () => {
		const clock = ItemSchema.parse({
			...createProducerItem({
				id: item.uid,
			}),
			uid: item.uid,
			clock: {
				intervalMs: 1500,
				durationMs: 2000,
			},
		});
		state.persisted = clock;
		(
			state.project as {
				config: {
					items: Record<string, ItemSchema.Type>;
				};
			}
		).config.items[item.uid] = clock;
		const { container } = await render(<ClockSection />);
		const duration = container.querySelector<HTMLInputElement>(
			'input[name="clock.durationMs"]',
		);
		if (duration === null) throw new Error("Missing clock lifetime field.");
		const clear = container.querySelector<HTMLButtonElement>('button[title="Clear lifetime"]');
		if (clear === null) throw new Error("Missing lifetime clear action");
		await act(async () => clear.click());
		expect(duration.value).toBe("");
		await act(async () => {
			await state.unsavedSession?.saveFn();
		});
		expect(state.saveItem).toHaveBeenCalledWith(
			expect.objectContaining({
				item: expect.objectContaining({
					clock: expect.objectContaining({
						intervalMs: 1500,
						durationMs: undefined,
					}),
					lines: clock.lines,
				}),
			}),
		);
	});

	it("clears the Clock interval while preserving the edited lifetime and expiry line", async () => {
		const expiryOutcome = createOutput([
			{
				itemUid: item.uid,
			},
		]);
		const scheduled = ItemSchema.parse({
			...item,
			lines: [
				createExpiryLine(expiryOutcome),
			],
			clock: {
				intervalMs: 1500,
				durationMs: 1000,
			},
		});
		state.persisted = scheduled;
		(state.project as Project).config.items[item.uid] = scheduled;
		const { container } = await render(<ClockSection />);
		const interval = container.querySelector<HTMLInputElement>(
			'input[name="clock.intervalMs"]',
		);
		const duration = container.querySelector<HTMLInputElement>(
			'input[name="clock.durationMs"]',
		);
		if (interval === null || duration === null) throw new Error("Missing Clock timer fields.");
		await changeInput(duration, "5");
		await changeInput(interval, "");
		await changeInput(interval, "2");
		await changeInput(interval, "");
		await act(async () => {
			await state.unsavedSession?.saveFn();
		});
		const saved = state.saveItem.mock.lastCall?.[0].item;
		expect(saved).toMatchObject({
			lines: [
				createExpiryLine(expiryOutcome),
			],
			clock: {
				durationMs: 5000,
			},
		});
		expect(saved.clock.intervalMs).toBeUndefined();
	});

	it("marks both missing Clock timers invalid and focuses the first field", async () => {
		const once: ItemSchema.Type = {
			...item,
			clock: {
				durationMs: 2000,
				enable: true,
				rules: [],
			},
		};
		state.persisted = once;
		(
			state.project as {
				config: {
					items: Record<string, ItemSchema.Type>;
				};
			}
		).config.items[item.uid] = once;
		const { container } = await render(<ClockSection />);
		const duration = container.querySelector<HTMLInputElement>(
			'input[name="clock.durationMs"]',
		);
		const interval = container.querySelector<HTMLInputElement>(
			'input[name="clock.intervalMs"]',
		);
		const saveButton = [
			...container.querySelectorAll("button"),
		].find((button) => button.textContent === "Save");
		if (interval === null || duration === null || saveButton === undefined)
			throw new Error("Missing Once lifetime form.");

		await changeInput(duration, "");
		await act(async () => {
			saveButton.click();
			await Promise.resolve();
		});

		expect(state.saveItem).not.toHaveBeenCalled();
		expect(duration.dataset.uiInvalid).toBe("true");
		expect(interval.dataset.uiInvalid).toBe("true");
		await act(
			() =>
				new Promise<void>((resolve) => {
					requestAnimationFrame(() => resolve());
				}),
		);
		expect(document.activeElement).toBe(duration);
		await changeInput(interval, "1");
		await act(async () => {
			await state.unsavedSession?.saveFn();
		});
		expect(state.saveItem.mock.lastCall?.[0].item.clock).toMatchObject({
			intervalMs: 1000,
		});
		expect(duration.dataset.uiInvalid).not.toBe("true");
		expect(interval.dataset.uiInvalid).not.toBe("true");
	});

	it.each([
		"edited",
		"blurred",
	] as const)(
		"pins %s item values through MCP refresh and renews the revision after discard and save",
		async (interaction) => {
			let project = {
				...(state.project as Project),
				revision: 1,
			};
			state.project = project;
			const { container, renderSection } = await render(<IdentitySection />);
			const publishItem = async (canonical: ItemSchema.Type) => {
				project = {
					...project,
					revision: project.revision + 1,
					config: {
						...project.config,
						items: {
							[canonical.uid]: canonical,
						},
					},
				};
				state.project = project;
				state.persisted = canonical;
				await renderSection(<IdentitySection />);
			};
			await publishItem({
				...item,
				title: "First MCP title",
			});
			const title = container.querySelector<HTMLInputElement>('input[name="title"]');
			if (title === null) throw new Error("Missing item title input.");
			expect(title.value).toBe("First MCP title");
			if (interaction === "edited") await changeInput(title, "Local title");
			else
				await act(async () => {
					title.focus();
					title.blur();
				});
			await publishItem({
				...item,
				description: "Second MCP description",
			});
			if (interaction === "blurred") {
				expect(title.value).toBe("First MCP title");
				await changeInput(title, "Local title");
			}
			state.saveItem.mockImplementation(async ({ expectedRevision, item: candidate }) => {
				if (expectedRevision !== project.revision) throw new Error("Stale draft");
				await publishItem(candidate);
				return candidate;
			});
			await act(async () => {
				await expect(state.unsavedSession?.saveFn()).rejects.toThrow("Stale draft");
			});
			expect(state.saveItem).toHaveBeenLastCalledWith(
				expect.objectContaining({
					expectedRevision: 2,
					item: expect.objectContaining({
						title: "Local title",
						description: item.description,
					}),
				}),
			);
			expect(title.value).toBe("Local title");
			await act(async () => state.unsavedSession?.discardFn());
			await changeInput(title, "Saved title");
			await act(async () => {
				await state.unsavedSession?.saveFn();
			});
			expect(state.saveItem).toHaveBeenLastCalledWith(
				expect.objectContaining({
					expectedRevision: 3,
					item: expect.objectContaining({
						description: "Second MCP description",
					}),
				}),
			);
			await changeInput(title, "Saved again");
			await act(async () => {
				await state.unsavedSession?.saveFn();
			});
			expect(state.saveItem).toHaveBeenLastCalledWith(
				expect.objectContaining({
					expectedRevision: 4,
				}),
			);
		},
	);
});

vi.mock("~/translation/ui/useTranslator", () => {
	const translator = {
		textFn: (key: string) => key,
	};
	return {
		useTranslator: () => translator,
	};
});

it("generates a fresh UID when duplicating a production line", async () => {
	let session: ReturnType<typeof useFormSession> | undefined;
	const Probe = () => {
		session = useFormSession();
		return <ProductionSection />;
	};
	const configured = createProducerItem({
		id: item.uid,
		lines: [
			createLine({
				uid: "line:original",
			}),
		],
	});
	state.persisted = configured;
	(state.project as Project).config.items[item.uid] = configured;
	const { container } = await render(<Probe />);
	const duplicate = container.querySelector<HTMLButtonElement>(
		'[data-ui="EditorProductionLinesCollection"] [data-ui="EditorCollectionDuplicate"]',
	);
	if (duplicate === null) throw new Error("Missing duplicate line control.");
	await act(async () => duplicate.click());
	const duplicateUid = session?.form.state.values.lines?.[1].uid;
	expect(duplicateUid).toBeTruthy();
	expect(duplicateUid).not.toBe("line:original");
	expect(session?.form.state.values.lines?.[0].uid).toBe("line:original");
	const savedUid = session?.form.state.values.lines?.[1].uid;
	await act(async () => {
		expect(await session?.saveFn()).toBe(true);
	});
	expect(state.saveItem.mock.lastCall?.[0].item.lines[1].uid).toBe(savedUid);
});
