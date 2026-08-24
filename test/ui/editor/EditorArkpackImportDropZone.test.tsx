// @vitest-environment jsdom

import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import { EditorArkpackImportDropZone } from "~/ui/arkpack/editor/EditorArkpackImportDropZone";

(
	globalThis as {
		IS_REACT_ACT_ENVIRONMENT?: boolean;
	}
).IS_REACT_ACT_ENVIRONMENT = true;

const roots: Array<ReturnType<typeof createRoot>> = [];

afterEach(async () => {
	await act(async () => {
		for (const root of roots.splice(0)) root.unmount();
	});
	document.body.replaceChildren();
	vi.restoreAllMocks();
});

describe("EditorArkpackImportDropZone", () => {
	it("keeps one nested drag session active until it delivers the dropped arkpack", async () => {
		const onFile = vi.fn();
		const container = document.createElement("div");
		document.body.append(container);
		const root = createRoot(container);
		roots.push(root);
		await act(async () => {
			root.render(
				createElement(EditorArkpackImportDropZone, {
					blocked: false,
					onFile,
					pending: false,
				}),
			);
		});
		const dropZone = container.querySelector<HTMLButtonElement>(
			'[data-ui="EditorArkpackImportDropZone"]',
		);
		if (dropZone === null) throw new Error("Missing Arkpack import drop zone.");
		const idleClassName = dropZone.className;

		await act(async () => {
			dropZone.dispatchEvent(
				new Event("dragenter", {
					bubbles: true,
					cancelable: true,
				}),
			);
			dropZone.dispatchEvent(
				new Event("dragenter", {
					bubbles: true,
					cancelable: true,
				}),
			);
		});
		const draggingClassName = dropZone.className;
		expect(draggingClassName).not.toBe(idleClassName);

		await act(async () => {
			dropZone.dispatchEvent(
				new Event("dragleave", {
					bubbles: true,
					cancelable: true,
				}),
			);
		});
		expect(dropZone.className).toBe(draggingClassName);

		const file = new File(
			[
				"arkpack",
			],
			"demo.arkpack",
			{
				type: "application/octet-stream",
			},
		);
		const drop = new Event("drop", {
			bubbles: true,
			cancelable: true,
		});
		Object.defineProperty(drop, "dataTransfer", {
			value: {
				files: {
					item: () => file,
				},
			},
		});
		await act(async () => {
			dropZone.dispatchEvent(drop);
		});

		expect(dropZone.className).toBe(idleClassName);
		expect(onFile).toHaveBeenCalledOnce();
		expect(onFile).toHaveBeenCalledWith(file);
	});
});
