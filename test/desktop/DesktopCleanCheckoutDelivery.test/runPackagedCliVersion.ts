import { execFile } from "node:child_process";
import { join } from "node:path";
import { promisify } from "node:util";

import packageJson from "../../../package.json" with { type: "json" };

const execFileAsync = promisify(execFile);

export const runPackagedCliVersion = async (workspace: string) => {
	const executable = join(
		workspace,
		".out/desktop/release",
		"mac-arm64/Arkini.app/Contents/MacOS/arkini-cli",
	);
	const result = await execFileAsync(executable, [
		"--version",
	]);
	return {
		expectedVersion: packageJson.version,
		output: result.stdout,
	};
};
