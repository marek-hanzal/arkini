// @vitest-environment jsdom

import { act } from "react";
import { describe, expect, it, vi } from "vitest";

import { buttonByText, renderSettings } from "./Settings.test/fixture";

describe("Settings CLI integration", () => {
	it("wires explicit replacement for a conflicting command", async () => {
		const { container, replaceCli } = await renderSettings(
			[
				"/settings/dev",
			],
			{
				cliStatus: {
					type: "conflict",
					commandPath: "/tmp/arkini-cli",
					message: "Another file already exists at /tmp/arkini-cli.",
					replaceable: true,
				},
			},
		);

		await vi.waitFor(() => expect(buttonByText(container, "Replace").disabled).toBe(false));
		await act(async () => buttonByText(container, "Replace").click());
		await vi.waitFor(() => expect(replaceCli).toHaveBeenCalledOnce());
	});

	it("allows managed completion cleanup without the command shim", async () => {
		const { container, uninstallCompletion } = await renderSettings(
			[
				"/settings/dev",
			],
			{
				cliStatus: {
					type: "not-installed",
					commandPath: "/tmp/arkini-cli",
				},
				completionStatus: {
					type: "installed",
					completionPath: "/tmp/_arkini-cli",
					shell: "zsh",
				},
			},
		);

		await vi.waitFor(() => expect(buttonByText(container, "Uninstall").disabled).toBe(false));
		await act(async () => buttonByText(container, "Uninstall").click());
		await vi.waitFor(() => expect(uninstallCompletion).toHaveBeenCalledOnce());
	});
});
