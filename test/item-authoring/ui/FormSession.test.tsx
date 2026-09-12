// @vitest-environment jsdom

import type { Project } from "~/project-authoring/type/Project";
import { ItemSchema } from "~/item-definition/schema/ItemSchema";
import { act, createElement, memo, type ButtonHTMLAttributes, type ReactNode } from "react";
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

vi.mock("~/ui/ui/Button", () => ({
	Button: ({ children, cursorIntent: _cursorIntent, ...props }: MockButtonProps) =>
		createElement("button", props, children),
	ButtonLink: ({
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
	saveItem: vi.fn(),
	unsavedSession: undefined as
		| {
				readonly saveFn: () => Promise<boolean>;
				readonly discardFn: () => void;
		  }
		| undefined,
}));

vi.mock("~/authoring-session/ui/useEditorUnsavedChangesRegistration", () => ({
	useEditorUnsavedChangesRegistration: (session: typeof state.unsavedSession) => {
		state.unsavedSession = session;
	},
}));

vi.mock("~/authoring-session/ui/useEditorProject", () => ({
	useEditorProject: () => state.project,
}));

vi.mock("~/item-authoring/ui/useItemByUid", () => ({
	useItemByUid: () => state.persisted,
}));

vi.mock("~/authoring-form/ui/AssetAutocompleteField", () => ({
	AssetAutocompleteField: ({ label }: { readonly label: string }) =>
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
import { ArtworkSection } from "~/item-authoring/ui/ArtworkSection";
import { useFormSession } from "~/item-authoring/ui/FormContext";
import { IdentitySection } from "~/item-authoring/ui/IdentitySection";
import { ClockSection } from "~/item-authoring/ui/ClockSection";
import { ProductionSection } from "~/item-authoring/ui/ProductionSection";
import { ActionSection } from "~/item-authoring/ui/ActionSection";
import type { OptionalCapability, SectionId } from "~/item-authoring/type/Section";
import {
	createLine,
	createOutput,
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
	lines: [],

	uid: "q12cmsx5ussy30wyjiea8yaw",
	id: "item:water",

	title: "Water",
	description: "Fresh water.",
	asset: {
		scale: 0.8,
		default: [
			"asset:water",
		],
	},
	scope: "any",
	maxStackSize: 1,
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
				inventory: {
					width: 2,
					height: 2,
				},
			},
			resources: {
				hero: "hero",
			},
			start: {
				currentSpace: 0,
				board: [],
				inventory: [],
				toolbar: [],
			},
			items: {
				[item.id]: item,
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
	defaultDraft?: boolean,
	enableCapability?: OptionalCapability,
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
								defaultDraft,
								defaultItemId: "dirty-bucket",
								defaultTitle: "Dirty Bucket",
								create: true as const,
							}
						: {})}
					sectionId={sectionId}
					enableCapability={enableCapability}
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

describe("item section form session", () => {
	it.each([
		[
			"units",
			"identity",
		],
		[
			"action",
			"interactions",
		],
		[
			"clock",
			"production",
		],
	] as const)(
		"returns %s edits to the %s detail after Save and Discard",
		async (sectionId, destination) => {
			const { container, renderSection } = await render(<IdentitySection />);
			await renderSection(<IdentitySection />, sectionId);
			const title = container.querySelector<HTMLInputElement>('input[name="title"]');
			if (title === null) throw new Error("Missing title input");
			await changeInput(title, "Changed");
			const buttonFn = (label: string) =>
				[
					...container.querySelectorAll("button"),
				].find((button) => button.textContent === label);
			await act(async () => {
				buttonFn("Save")?.click();
			});
			expect(state.navigate).toHaveBeenLastCalledWith(
				expect.objectContaining({
					to: "/editor/$projectId/editor/items/$itemUid/detail/$sectionId",
					params: expect.objectContaining({
						sectionId: destination,
					}),
				}),
			);
			const saves = state.saveItem.mock.calls.length;
			await changeInput(title, "Discarded");
			await act(async () => {
				buttonFn("Discard")?.click();
			});
			expect(state.navigate).toHaveBeenLastCalledWith(
				expect.objectContaining({
					params: expect.objectContaining({
						sectionId: destination,
					}),
				}),
			);
			expect(state.saveItem).toHaveBeenCalledTimes(saves);
		},
	);
	it.each([
		"action",
		"production",
	] as const)("keeps the detail %s enable intent local until Save", async (capability) => {
		const configured = ItemSchema.parse({
			...item,
			lines: [],
			...(capability === "production"
				? {
						action: {
							type: "inventory",
							input: [],
							rules: [],
						},
					}
				: {
						clock: {
							intervalMs: 300000,
						},
						scope: "board",
						maxStackSize: 1,
					}),
		});
		state.persisted = configured;
		(state.project as Project).config.items[item.id] = configured;
		const { container } = await render(<IdentitySection />, false, undefined, capability);
		expect(state.saveItem).not.toHaveBeenCalled();
		await act(async () => {
			[
				...container.querySelectorAll("button"),
			]
				.find((button) => button.textContent === "Save")
				?.click();
		});
		const saved = state.saveItem.mock.lastCall?.[0].item;
		if (capability === "action") {
			expect(saved.action.type).toBe("space");
			expect(saved.clock).toBeUndefined();
			expect(saved.lines).toEqual([]);
		} else {
			expect(saved.action).toBeUndefined();
			expect(saved.lines).toHaveLength(1);
		}
	});

	it("keeps an asset-origin draft seed in routed section links", async () => {
		state.persisted = undefined;
		const { container } = await render(<IdentitySection />, true, true);
		expect(container.querySelector("h1")?.textContent).toBe("Dirty Bucket");
		const title = container.querySelector<HTMLInputElement>('input[name="title"]');
		if (title === null) throw new Error("Missing seeded title field");
		await changeInput(title, "Washed Bucket");
		expect(container.querySelector("h1")?.textContent).toBe("Washed Bucket");
		expect(state.saveItem).not.toHaveBeenCalled();
		const artworkLink = [
			...container.querySelectorAll<HTMLAnchorElement>("a"),
		].find((link) => link.textContent === "Artwork");
		if (artworkLink === undefined) throw new Error("Missing Artwork section link.");

		expect(JSON.parse(artworkLink.dataset.search ?? "null")).toMatchObject({
			defaultDraft: true,
			defaultItemId: "dirty-bucket",
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
					id: "dirty-bucket",
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
			asset: {
				...item.asset,
				scale: 0.65,
			},
		};
		state.persisted = scaledItem;
		const { container } = await render(<ArtworkSection />);
		const scale = container.querySelector<HTMLInputElement>('input[name="asset.scale"]');
		if (scale === null) throw new Error("Missing artwork scale control.");
		expect(scale.value).toBe("0.65");
		await changeInput(scale, "0.9");
		await act(async () => {
			await state.unsavedSession?.saveFn();
		});
		expect(state.saveItem).toHaveBeenCalledOnce();
		expect(state.saveItem.mock.calls[0]?.[0].item.asset).toEqual({
			...item.asset,
			scale: 0.9,
		});
		expect(scaledItem.asset.scale).toBe(0.65);
	});

	it("picks both bounds of the reserved random space range into the local draft", async () => {
		const spaceItem = {
			...item,

			action: {
				type: "space" as const,
				space: 0,
				input: [],
				rules: [],
			},
		} satisfies ItemSchema.Type;
		state.persisted = spaceItem;
		(
			state.project as {
				config: {
					items: Record<string, ItemSchema.Type>;
				};
			}
		).config.items[item.id] = spaceItem;
		const random = vi
			.spyOn(Math, "random")
			.mockReturnValueOnce(0)
			.mockReturnValueOnce(1 - Number.EPSILON);
		try {
			const { container } = await render(<ActionSection />);
			const input = container.querySelector<HTMLInputElement>('input[name="action.space"]');
			const pickRandomSpaceButton = [
				...container.querySelectorAll("button"),
			].find((button) => button.textContent === "Pick random space");
			if (input === null || pickRandomSpaceButton === undefined)
				throw new Error("Missing Space action controls.");

			await act(async () => pickRandomSpaceButton.click());
			expect(input.value).toBe("128");
			await act(async () => pickRandomSpaceButton.click());
			expect(input.value).toBe("1024");
			expect(state.saveItem).not.toHaveBeenCalled();
		} finally {
			random.mockRestore();
		}
	});

	it("does not republish the form Context when parent inputs are unchanged", async () => {
		let consumerRenders = 0;
		const Probe = memo(() => {
			useFormSession();
			consumerRenders += 1;
			return null;
		});
		const probe = <Probe />;
		const { renderSection } = await render(probe);

		await renderSection(probe);

		expect(consumerRenders).toBe(1);
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
					title: "Saved and leave",
				}),
			}),
		);
		expect(state.navigate).toHaveBeenCalledOnce();
	});

	it("marks the item ID field when another UID already owns the draft ID", async () => {
		const duplicate = {
			...item,
			id: "item:duplicate",
			uid: "duplicate-uid",
		};
		(
			state.project as {
				config: {
					items: Record<string, ItemSchema.Type>;
				};
			}
		).config.items[duplicate.id] = duplicate;
		const { container } = await render(<IdentitySection />);
		const id = container.querySelector<HTMLInputElement>('input[name="id"]');
		if (id === null) throw new Error("Missing item ID input.");

		await changeInput(id, duplicate.id);
		const saveButton = [
			...container.querySelectorAll("button"),
		].find((button) => button.textContent === "Save");
		await act(async () => {
			saveButton?.click();
			await Promise.resolve();
		});

		expect(state.saveItem).not.toHaveBeenCalled();
		expect(id.dataset.uiInvalid).toBe("true");
		expect(container.textContent).toContain(
			"Item ID item:duplicate is already used by another item.",
		);
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

	it("retains the local draft across routed section replacement", async () => {
		const { container, renderSection } = await render(<IdentitySection />);
		const title = container.querySelector<HTMLInputElement>('input[name="title"]');
		if (title === null) throw new Error("Missing item title input.");

		await changeInput(title, "Changed water");
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
						itemId: item.id,
						type: "item",
					},
				},
				{
					action: "use",
					effect: "remove",
					target: {
						itemId: item.id,
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
		).config.items[item.id] = itemWithMerges;
		const InvalidMergeProbe = () => {
			const { form } = useFormSession();
			return (
				<button
					type="button"
					onClick={() => form.setFieldValue("merge[1].target.itemId", "")}
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

	it("selects and focuses the exact invalid control inside a nested output", async () => {
		const producer = createProducerItem({
			id: "producer",
			output: createOutput([
				{
					itemId: item.id,
				},
			]),
		});
		state.persisted = producer;
		const config = (
			state.project as {
				config: {
					items: Record<string, ItemSchema.Type>;
				};
			}
		).config;
		config.items = {
			[item.id]: item,
			[producer.id]: producer,
		};
		const { container } = await render(<ProductionSection />);
		const addOutputSet = container.querySelector<HTMLButtonElement>(
			'button[title="Add output set"]',
		);
		const saveButton = [
			...container.querySelectorAll("button"),
		].find((button) => button.textContent === "Save");
		if (addOutputSet === null || saveButton === undefined)
			throw new Error("Missing nested output controls.");

		await act(async () => addOutputSet.click());
		await act(async () => {
			saveButton.click();
			await Promise.resolve();
		});

		const invalid = container.querySelector<HTMLInputElement>('input[data-ui-invalid="true"]');
		expect(container.textContent).toContain(
			"Production line 1 → Output → Output set 2 → Roll 1 → Drop 1 → Dropped item: Select an item.",
		);
		await act(
			() =>
				new Promise<void>((resolve) => {
					requestAnimationFrame(() => resolve());
				}),
		);
		expect(document.activeElement).toBe(invalid);
	});

	it("replaces production with an action in the canonical saved item", async () => {
		const common = {
			...createProducerItem({
				id: item.id,
			}),
			uid: item.uid,
		};
		state.persisted = common;
		(state.project as Project).config.items[item.id] = common;
		const { container } = await render(<ActionSection />);
		const enable = [
			...container.querySelectorAll("button"),
		].find((button) => button.textContent === "Enable action");
		if (enable === undefined) throw new Error("Missing enable action control.");
		await act(async () => enable.click());
		// Persist the action and empty lines as one canonical item.
		await act(async () => {
			await state.unsavedSession?.saveFn();
		});
		expect(state.saveItem).toHaveBeenLastCalledWith(
			expect.objectContaining({
				item: expect.objectContaining({
					lines: [],
					action: {
						type: "space",
						space: 0,
						input: [],
						rules: [],
					},
				}),
			}),
		);
	});
	it("switches the action payload without losing shared requirements or rules", async () => {
		const rule = {
			type: "enable" as const,
			when: [
				{
					type: "exists" as const,
					query: {
						scope: "universe" as const,
						selector: {
							type: "item" as const,
							itemId: item.id,
						},
					},
				},
			] as [
				{
					type: "exists";
					query: {
						scope: "universe";
						selector: {
							type: "item";
							itemId: string;
						};
					};
				},
			],
		};
		const input = {
			type: "simple" as const,
		};
		const portal = {
			...item,
			action: {
				type: "space" as const,
				space: 7,
				input: [
					input,
				],
				rules: [
					rule,
				],
			},
		};
		state.persisted = portal;
		(state.project as Project).config.items[item.id] = portal;
		const { container } = await render(<ActionSection />);
		const inventory = [
			...container.querySelectorAll("button"),
		].find((button) => button.textContent === "Inventory");
		if (inventory === undefined) throw new Error("Missing Inventory action choice.");
		await act(async () => inventory.click());
		await act(async () => {
			await state.unsavedSession?.saveFn();
		});
		expect(state.saveItem).toHaveBeenLastCalledWith(
			expect.objectContaining({
				item: expect.objectContaining({
					action: {
						type: "inventory",
						input: [
							input,
						],
						rules: [
							rule,
						],
					},
				}),
			}),
		);
	});
	it("replaces a configured action when the first production line is added", async () => {
		const common = {
			...item,

			action: {
				type: "space" as const,
				space: 7,
				input: [],
				rules: [],
			},
		};
		state.persisted = common;
		(state.project as Project).config.items[item.id] = common;
		const { container } = await render(<ProductionSection />);
		const add = container.querySelector<HTMLButtonElement>('button[title="Add line"]');
		if (add === null) throw new Error("Missing add line control.");
		await act(async () => add.click());
		await act(async () => {
			await state.unsavedSession?.saveFn();
		});
		expect(state.saveItem).toHaveBeenLastCalledWith(
			expect.objectContaining({
				item: expect.objectContaining({
					action: undefined,
					lines: [
						expect.objectContaining({
							default: true,
						}),
					],
				}),
			}),
		);
	});
	it("disables a configured action without changing the item identity", async () => {
		const common = {
			...item,

			action: {
				type: "space" as const,
				space: 7,
				input: [],
				rules: [],
			},
		};
		state.persisted = common;
		(state.project as Project).config.items[item.id] = common;
		const { container } = await render(<ActionSection />);
		const disable = [
			...container.querySelectorAll("button"),
		].find((button) => button.textContent === "Disable");
		if (disable === undefined) throw new Error("Missing disable action control.");
		await act(async () => disable.click());
		await act(async () => {
			await state.unsavedSession?.saveFn();
		});
		expect(state.saveItem).toHaveBeenLastCalledWith(
			expect.objectContaining({
				item: expect.objectContaining({
					id: item.id,
					action: undefined,
					lines: [],
				}),
			}),
		);
	});

	it("adds production to a passive Common through the ordinary line editor", async () => {
		const { container } = await render(<ProductionSection />);
		const addLine = container.querySelector<HTMLButtonElement>('button[title="Add line"]');
		if (addLine === null) throw new Error("Missing add line control.");
		await act(async () => addLine.click());
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
				id: item.id,
			}),
			uid: item.uid,
		};
		state.persisted = common;
		(state.project as Project).config.items[item.id] = common;
		const { container } = await render(<ProductionSection />);
		const removeLine = container.querySelector<HTMLButtonElement>(
			'button[title="Remove line"]',
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

	it("selects Default and Clock exclusively across sibling lines through the saved form", async () => {
		state.saveItem.mockImplementation(async ({ item }: { item: ItemSchema.Type }) => {
			state.persisted = item;
			(state.project as Project).config.items[item.id] = item;
			return item;
		});
		const common = {
			...createProducerItem({
				id: item.id,
			}),
			uid: item.uid,
			lines: [
				createLine({
					id: "line:first",
					default: false,
				}),
				createLine({
					id: "line:second",
					default: true,
					clock: true,
				}),
			],
		};
		state.persisted = common;
		(state.project as Project).config.items[item.id] = common;
		const { container, renderSection } = await render(<ProductionSection />);
		const toggle = async (label: string) => {
			const button = [
				...container.querySelectorAll("button"),
			].find((candidate) => candidate.textContent === label);
			if (button === undefined) throw new Error(`Missing ${label} toggle.`);
			await act(async () => button.click());
			await act(async () => {
				await state.unsavedSession?.saveFn();
			});
			// The repository hook mock needs an explicit render to publish the saved canonical item.
			await renderSection(<ProductionSection />);
			return state.saveItem.mock.lastCall?.[0].item.lines;
		};
		expect(await toggle("Default")).toMatchObject([
			{
				default: true,
			},
			{
				default: false,
				clock: true,
			},
		]);
		expect(await toggle("Clock")).toMatchObject([
			{
				default: true,
				clock: true,
			},
			{
				default: false,
				clock: false,
			},
		]);
		expect(await toggle("Default")).toMatchObject([
			{
				default: false,
				clock: true,
			},
			{
				default: false,
				clock: false,
			},
		]);
		expect(await toggle("Clock")).toMatchObject([
			{
				default: false,
				clock: false,
			},
			{
				default: false,
				clock: false,
			},
		]);
	});

	it.each([
		"form",
		"detail",
	] as const)("enables a clock through the %s entry as one valid saved item", async (entry) => {
		const common = {
			...item,

			scope: "inventory" as const,
			maxStackSize: 9,
			action: {
				type: "space" as const,
				space: 2,
				input: [],
				rules: [],
			},
		};
		state.persisted = common;
		(state.project as Project).config.items[item.id] = common;
		const { container } = await render(
			<ClockSection />,
			false,
			undefined,
			entry === "detail" ? "clock" : undefined,
		);
		if (entry === "form") {
			const enable = [
				...container.querySelectorAll("button"),
			].find((button) => button.textContent === "Enable clock");
			if (enable === undefined) throw new Error("Missing clock enable control.");
			await act(async () => enable.click());
		}
		expect(state.saveItem).not.toHaveBeenCalled();
		await act(async () => {
			await state.unsavedSession?.saveFn();
		});
		expect(state.saveItem.mock.lastCall?.[0].item).toMatchObject({
			scope: "board",
			maxStackSize: 1,
			action: undefined,
			clock: {
				intervalMs: 300_000,
				durationMs: 3_600_000,
			},
			lines: [],
		});
	});

	it("saves a Clock with a cleared optional lifetime while retaining its interval and production lines", async () => {
		const clock = ItemSchema.parse({
			...createProducerItem({
				id: item.id,
			}),
			uid: item.uid,

			scope: "board",
			maxStackSize: 1,
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
		).config.items[item.id] = clock;
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

	it("clears the Clock interval while preserving the edited lifetime and expiry output", async () => {
		const onExpire = createOutput([
			{
				itemId: item.id,
			},
		]);
		const scheduled = ItemSchema.parse({
			...item,
			scope: "board",
			clock: {
				intervalMs: 1500,
				onExpire,
			},
		});
		state.persisted = scheduled;
		(state.project as Project).config.items[item.id] = scheduled;
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
			lines: [],
			clock: {
				durationMs: 5000,
				onExpire,
			},
		});
		expect(saved.clock.intervalMs).toBeUndefined();
	});

	it("marks both missing Clock timers invalid and focuses the first field", async () => {
		const once: ItemSchema.Type = {
			...item,

			scope: "board",
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
		).config.items[item.id] = once;
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
		expect(document.activeElement).toBe(interval);
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
							[canonical.id]: canonical,
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

vi.mock("~/translation/ui/useTranslator", () => ({
	useTranslator: () => ({
		textFn: (key: string) => key,
	}),
}));
