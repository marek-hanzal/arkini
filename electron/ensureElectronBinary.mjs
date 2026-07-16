import { access } from "node:fs/promises";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

let electronPath;
try {
	electronPath = require("electron");
	if (typeof electronPath !== "string") {
		throw new TypeError("Electron package did not resolve to an executable path.");
	}
	await access(electronPath);
} catch (cause) {
	throw new Error(
		"Electron binary is unavailable. The desktop preflight attempted its lazy install; check network/proxy access and rerun npm run dev:desktop.",
		{
			cause,
		},
	);
}

console.log(`Electron binary ready at ${electronPath}`);
