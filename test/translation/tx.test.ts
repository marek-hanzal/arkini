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
	it("adds live literals, removes dead static keys and preserves dynamic keys", async () => {
		const root = await mkdtemp(join(tmpdir(), "arkini-translations-"));
		temporaryRoots.push(root);
		const sourceDirectory = join(root, "translations");
		const runtimePath = join(root, "generated", "EnglishTranslations.ts");
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
		await writeFile(
			join(sourceDirectory, "en.yaml"),
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
			locales: [
				"en",
			],
			mode: "sync",
			packages: [
				root,
			],
			runtimeOutput: {
				locale: "en",
				path: runtimePath,
			},
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

		const translations = TranslationListSchema.parse(
			parse(await readFile(join(sourceDirectory, "en.yaml"), "utf8")),
		);
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
		expect(await readFile(runtimePath, "utf8")).toContain('key: "Markdown help"');
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

		await writeFile(runtimePath, "stale runtime catalog\n");
		await expect(
			Effect.runPromise(
				tx({
					...props,
					mode: "check",
				}).pipe(Effect.provide(NodeServices.layer)),
			),
		).rejects.toThrow("Translation sources are out of sync");
	});

	it("leaves the catalog untouched when a source file cannot be parsed", async () => {
		const root = await mkdtemp(join(tmpdir(), "arkini-translations-invalid-"));
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
				include: [
					"src",
				],
			}),
		);
		await writeFile(join(root, "src", "Broken.ts"), 'translator.textFn("Unclosed";\n');
		const original = `Existing label:\n  value: Keep me\n`;
		const sourcePath = join(sourceDirectory, "en.yaml");
		await writeFile(sourcePath, original);

		await expect(
			Effect.runPromise(
				tx({
					locales: [
						"en",
					],
					mode: "sync",
					packages: [
						root,
					],
					runtimeOutput: {
						locale: "en",
						path: join(root, "generated", "EnglishTranslations.ts"),
					},
					sourceDirectory,
					sources: {
						functions: [],
						jsx: [],
						objects: [
							{
								name: "textFn",
								object: "translator",
							},
						],
					},
				}).pipe(Effect.provide(NodeServices.layer)),
			),
		).rejects.toThrow("cannot be parsed");
		expect(await readFile(sourcePath, "utf8")).toBe(original);
	});

	it("leaves every catalog artifact untouched when discovery finds no source files", async () => {
		const root = await mkdtemp(join(tmpdir(), "arkini-translations-empty-"));
		temporaryRoots.push(root);
		const sourceDirectory = join(root, "translations");
		const runtimePath = join(root, "generated", "EnglishTranslations.ts");
		await mkdir(join(root, "src"), {
			recursive: true,
		});
		await mkdir(sourceDirectory, {
			recursive: true,
		});
		await mkdir(join(root, "generated"), {
			recursive: true,
		});
		await writeFile(
			join(root, "tsconfig.json"),
			JSON.stringify({
				include: [
					"src",
				],
			}),
		);
		await writeFile(join(root, "src", "Only.d.ts"), "declare const example: string;\n");
		const originalSource = `Existing label:\n  value: Keep me\n`;
		const originalRuntime = "existing generated catalog\n";
		const sourcePath = join(sourceDirectory, "en.yaml");
		await writeFile(sourcePath, originalSource);
		await writeFile(runtimePath, originalRuntime);

		await expect(
			Effect.runPromise(
				tx({
					locales: [
						"en",
					],
					mode: "sync",
					packages: [
						root,
					],
					runtimeOutput: {
						locale: "en",
						path: runtimePath,
					},
					sourceDirectory,
					sources: {
						functions: [],
						jsx: [],
						objects: [],
					},
				}).pipe(Effect.provide(NodeServices.layer)),
			),
		).rejects.toThrow("No translation source files were discovered");
		expect(await readFile(sourcePath, "utf8")).toBe(originalSource);
		expect(await readFile(runtimePath, "utf8")).toBe(originalRuntime);
	});
});
