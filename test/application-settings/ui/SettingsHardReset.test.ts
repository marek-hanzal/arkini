// @vitest-environment jsdom
import { act } from "react";
import { describe, expect, it, vi } from "vitest";
import { renderSettings } from "./Settings.test/fixture";

const resetButtonFn = (container: HTMLElement) => {
	const button = container.querySelector<HTMLButtonElement>(
		'[data-ui="SettingsHardReset"] button',
	);
	if (!button) throw new Error("Missing reset control");
	return button;
};

describe("Settings hard reset admission", () => {
	it("requires confirmation and admits only one reset while restarting", async () => {
		const { container, hardReset } = await renderSettings([
			"/settings/dev",
		]);
		const button = resetButtonFn(container);
		await act(async () => button.click());
		expect(hardReset).not.toHaveBeenCalled();
		await act(async () => {
			button.click();
			button.click();
		});
		await vi.waitFor(() => expect(hardReset).toHaveBeenCalledOnce());
		expect(button.disabled).toBe(true);
		await act(async () => button.click());
		expect(hardReset).toHaveBeenCalledOnce();
	});

	it("requires fresh confirmation after a rejected reset request", async () => {
		const { container, hardReset } = await renderSettings([
			"/settings/dev",
		]);
		hardReset.mockRejectedValueOnce(new Error("Relaunch failed"));
		const button = resetButtonFn(container);
		await act(async () => button.click());
		await act(async () => button.click());
		await vi.waitFor(() => expect(button.disabled).toBe(false));
		expect(hardReset).toHaveBeenCalledOnce();
		await act(async () => button.click());
		expect(hardReset).toHaveBeenCalledOnce();
		await act(async () => button.click());
		await vi.waitFor(() => expect(hardReset).toHaveBeenCalledTimes(2));
	});
});
