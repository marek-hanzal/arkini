import Ajv2020 from "ajv/dist/2020";
import { Effect } from "effect";
import { afterEach, expect, it } from "vitest";
import { z } from "zod";
import { readSchemaDetailTextFx } from "~/authoring-mcp/tool/readSchemaDetailTextFx";
import {
	cleanupMcpHarnesses,
	connectMcpClient,
	createMcpHarness,
} from "./support/createMcpHarness";

const registered: z.ZodType[] = [];
const registerFn = <Schema extends z.ZodType>(schema: Schema, id: string): Schema => {
	const result = schema.meta({
		...schema.meta(),
		id,
	});
	registered.push(result);
	return result;
};
const readFn = (id: string, depth = 0) =>
	JSON.parse(Effect.runSync(readSchemaDetailTextFx(id, depth)));
afterEach(async () => {
	for (const schema of registered) z.globalRegistry.remove(schema);
	registered.length = 0;
	await cleanupMcpHarnesses();
});

it("counts reference edges rather than object nesting and expands shared siblings independently", () => {
	const leaf = registerFn(z.string().min(3), "resolution.Leaf");
	const middle = registerFn(
		z.object({
			deep: z.object({
				value: leaf,
			}),
		}),
		"resolution.Middle",
	);
	registerFn(
		z.object({
			left: middle,
			right: middle,
			data: z.unknown().default({
				$ref: "resolution.Leaf",
			}),
		}),
		"resolution.Root",
	);
	const original = readFn("resolution.Root");
	expect(readFn("resolution.Root", 0)).toEqual(original);
	expect(original.properties.left.$ref).toBe("resolution.Middle");
	const one = readFn("resolution.Root", 1);
	const two = readFn("resolution.Root", 2);
	for (const side of [
		"left",
		"right",
	]) {
		expect(one.properties[side].properties.deep.properties.value.$ref).toBe("resolution.Leaf");
		expect(two.properties[side].properties.deep.properties.value).toMatchObject({
			type: "string",
			minLength: 3,
		});
		expect(two.properties[side]).not.toHaveProperty("$id");
	}
	expect(two.properties.data.default).toEqual({
		$ref: "resolution.Leaf",
	});
	expect(readFn("resolution.Root")).toEqual(original);
});

it("keeps recursive and unknown references finite at maximum depth", () => {
	const cycle: z.ZodType = registerFn(
		z.lazy(() =>
			z.object({
				next: cycle.optional(),
			}),
		),
		"resolution.Cycle",
	);
	registerFn(
		z.object({
			a: cycle,
			b: cycle,
			unknown: z.string().meta({
				$ref: "resolution.Missing",
			}),
		}),
		"resolution.CycleRoot",
	);
	const result = readFn("resolution.CycleRoot", 256);
	for (const side of [
		"a",
		"b",
	])
		expect(result.properties[side].properties.next).toEqual({
			$ref: "resolution.Cycle",
		});
	expect(result.properties.unknown.$ref).toBe("resolution.Missing");
	expect(readFn("resolution.Cycle", 256).properties.next.$ref).toBe("resolution.Cycle");
});

it("preserves reference sibling constraints and literal annotation data in a valid expanded schema", () => {
	registerFn(z.string().min(3), "resolution.ConstrainedLeaf");
	registerFn(
		z.object({
			value: z
				.string()
				.max(4)
				.meta({
					$ref: "resolution.ConstrainedLeaf",
					examples: [
						{
							$ref: "resolution.ConstrainedLeaf",
						},
					],
				}),
			other: z.string().meta({
				$ref: "resolution.ConstrainedLeaf",
			}),
		}),
		"resolution.ConstrainedRoot",
	);
	const result = readFn("resolution.ConstrainedRoot", 1);
	expect(result.properties.value.examples).toEqual([
		{
			$ref: "resolution.ConstrainedLeaf",
		},
	]);
	const validate = new Ajv2020({
		strict: false,
	}).compile(result);
	expect(
		validate({
			value: "abc",
			other: "def",
		}),
		JSON.stringify(validate.errors),
	).toBe(true);
	expect(
		validate({
			value: "ab",
			other: "def",
		}),
	).toBe(false);
	expect(
		validate({
			value: "abcde",
			other: "def",
		}),
	).toBe(false);
	expect(
		validate({
			value: "abc",
			other: "d",
		}),
	).toBe(false);
});

it("retains local fragment scope when embedding a registered schema", () => {
	registerFn(
		z
			.object({
				value: z.string().meta({
					$ref: "#/$defs/Local",
				}),
			})
			.meta({
				$defs: {
					Local: {
						type: "string",
						minLength: 3,
					},
				},
			}),
		"resolution.Local",
	);
	registerFn(
		z.object({
			child: z.unknown().meta({
				$ref: "resolution.Local",
			}),
		}),
		"resolution.LocalRoot",
	);
	const result = readFn("resolution.LocalRoot", 1);
	expect(JSON.stringify(result)).toContain('"$ref":"resolution.Local#/$defs/Local"');
	const validate = new Ajv2020({
		strict: false,
	})
		.addSchema(readFn("resolution.Local"), "resolution.Local")
		.compile(result);
	expect(
		validate({
			child: {
				value: "abc",
			},
		}),
		JSON.stringify(validate.errors),
	).toBe(true);
	expect(
		validate({
			child: {
				value: "ab",
			},
		}),
	).toBe(false);
});

it("exposes bounded optional resolveDepth through MCP without requiring an open project", async () => {
	const leaf = registerFn(z.string().min(2), "resolution.HttpLeaf");
	registerFn(
		z.object({
			value: leaf,
		}),
		"resolution.HttpRoot",
	);
	const { ownership, port } = await createMcpHarness();
	await Effect.runPromise(ownership.startLocalFx);
	const client = await connectMcpClient(port);
	const callFn = (resolveDepth?: unknown) =>
		client.callTool({
			name: "schema_detail",
			arguments: {
				id: "resolution.HttpRoot",
				...(resolveDepth === undefined
					? {}
					: {
							resolveDepth,
						}),
			},
		});
	expect(await callFn(0)).toEqual(await callFn());
	for (const depth of [
		1,
		256,
	]) {
		const result = await callFn(depth);
		expect(result.isError).not.toBe(true);
		const content = result.content[0];
		if (content?.type !== "text") throw new Error("Missing schema text");
		expect(JSON.parse(content.text).properties.value).toMatchObject({
			type: "string",
			minLength: 2,
		});
	}
	for (const invalid of [
		-1,
		257,
		1.5,
		"2",
		null,
	])
		expect((await callFn(invalid)).isError).toBe(true);
});
