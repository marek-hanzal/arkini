import { z } from "zod";

export const WindowModeSchema = z
	.enum([
		"default",
		"bordered",
		"fullscreen",
	])
	.meta({
		id: "WindowModeSchema",
		description:
			"The global native window mode. Default uses canonical window bounds, bordered fills the work area with a title bar, and fullscreen uses Electron's exclusive fullscreen.",
	});

export type WindowModeSchema = typeof WindowModeSchema;

export namespace WindowModeSchema {
	export type Type = z.infer<WindowModeSchema>;
}
