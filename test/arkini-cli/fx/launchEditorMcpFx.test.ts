import { chmod, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Effect } from "effect";
import { afterEach, describe, expect, it } from "vitest";

import {
	EditorMcpHeadlessLaunchArgument,
	EditorMcpHeadlessRemoteArgument,
} from "~electron/contract/editor/EditorMcpHeadlessLaunch";
import { launchEditorMcpFx } from "~/arkini-cli/fx/launchEditorMcpFx";

const temporaryDirectories: string[] = [];

afterEach(async () => {
	await Promise.all(
		temporaryDirectories.splice(0).map((directory) =>
			rm(directory, {
				force: true,
				recursive: true,
			}),
		),
	);
});

describe.skipIf(process.platform === "win32")("Editor MCP Electron handoff", () => {
	it("leaves Node mode and forwards the exact project and Remote request", async () => {
		const root = await mkdtemp(join(tmpdir(), "arkini-editor-mcp-launch-"));
		temporaryDirectories.push(root);
		const executable = join(root, "Arkini");
		const record = join(root, "launch.txt");
		await writeFile(
			executable,
			'#!/bin/sh\nset -eu\nprintf \'%s\\n\' "${ELECTRON_RUN_AS_NODE-unset}" "$@" > "$ARKINI_LAUNCH_RECORD_PATH"\n',
		);
		await chmod(executable, 0o755);

		await Effect.runPromise(
			launchEditorMcpFx({
				electronPath: executable,
				environment: {
					...process.env,
					ARKINI_LAUNCH_RECORD_PATH: record,
					ELECTRON_RUN_AS_NODE: "1",
				},
				projectId: "project:headless",
				remote: true,
			}),
		);

		expect((await readFile(record, "utf8")).trim().split("\n")).toEqual([
			"unset",
			EditorMcpHeadlessLaunchArgument,
			"project:headless",
			EditorMcpHeadlessRemoteArgument,
		]);
	});

	it("rejects when the headless Electron process exits unsuccessfully", async () => {
		const root = await mkdtemp(join(tmpdir(), "arkini-editor-mcp-failure-"));
		temporaryDirectories.push(root);
		const executable = join(root, "Arkini");
		await writeFile(executable, "#!/bin/sh\nexit 7\n");
		await chmod(executable, 0o755);

		await expect(
			Effect.runPromise(
				launchEditorMcpFx({
					electronPath: executable,
					environment: process.env,
					projectId: "project:missing",
					remote: false,
				}),
			),
		).rejects.toThrow("exited with code 7");
	});
});
