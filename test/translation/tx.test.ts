import * as NodeServices from "@effect/platform-node/NodeServices";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Effect } from "effect";
import { afterEach, describe, expect, it } from "vitest";
import { parse } from "yaml";

import { tx } from "~scripts/translation/tx";
import { TranslationListSchema } from "~/translation/schema/TranslationListSchema";

const temporaryRoots: string[] = [];

afterEach(async () => {
	await Promise.all(
		temporaryRoots.splice(0).map((root) =>
			rm(root, {
				force: true,
				recursive: true,
			}),
		),
	);
});

describe("tx", () => {
	it("reconciles exact live keys and reports catalog drift as typed failure", async () => {
		const root = await mkdtemp(join(tmpdir(), "arkini-translations-"));
		temporaryRoots.push(root);
		const sourceDirectory = join(root, "translations");
		await mkdir(join(root, "src"), {
			recursive: true,
		});
		await mkdir(sourceDirectory, {
			recursive: true,
		});
		await writeFile(
			join(root, "tsconfig.json"),
			JSON.stringify({
				compilerOptions: {
					jsx: "react-jsx",
				},
				include: [
					"src",
				],
			}),
		);
		await writeFile(
			join(root, "src", "Example.tsx"),
			`translator.textFn("Live label");
translator.textFn(\`Item type - \${type}\`);
const help = <Mx label="Markdown help" />;
`,
		);
		const sourcePath = join(sourceDirectory, "en.yaml");
		await writeFile(
			sourcePath,
			`Dead label:
  value: Remove me
Dynamic label:
  value: Keep me
  dynamic: true
Live label:
  value: Existing translation
`,
		);
		const props: tx.Props = {
			mode: "sync",
			packages: [
				root,
			],
			sourceDirectory,
			sources: {
				functions: [],
				jsx: [
					{
						attr: "label",
						name: "Mx",
					},
				],
				objects: [
					{
						name: "textFn",
						object: "translator",
					},
				],
			},
		};

		await Effect.runPromise(tx(props).pipe(Effect.provide(NodeServices.layer)));

		const translations = TranslationListSchema.parse(parse(await readFile(sourcePath, "utf8")));
		expect(translations).toEqual({
			"Dynamic label": {
				dynamic: true,
				value: "Keep me",
			},
			"Live label": {
				value: "Existing translation",
			},
			"Markdown help": {
				value: "Markdown help",
			},
		});
		await expect(
			Effect.runPromise(
				tx({
					...props,
					mode: "check",
				}).pipe(Effect.provide(NodeServices.layer)),
			),
		).resolves.toMatchObject({
			changed: [],
		});

		await writeFile(
			sourcePath,
			`Live label:
  value: Stale translation
`,
		);
		const failure = await Effect.runPromise(
			tx({
				...props,
				mode: "check",
			}).pipe(Effect.provide(NodeServices.layer), Effect.flip),
		);
		expect(failure).toMatchObject({
			_tag: "TranslationOutOfSyncError",
			paths: [
				sourcePath,
			],
		});
	});
});
