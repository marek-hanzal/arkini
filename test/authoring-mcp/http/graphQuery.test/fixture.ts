import { Effect } from "effect";
import { expect } from "vitest";
import { GameConfigSchema } from "~/game-config/schema/GameConfigSchema";
import { createJobTestConfig } from "~test/production-job/support/jobTestConfig";
import { connectMcpClient, createMcpHarness } from "../support/createMcpHarness";

export const toolJsonFn = <T>(result: { content?: unknown; isError?: unknown }): T => {
	expect(result.isError).not.toBe(true);
	const content = result.content as {
		type: string;
		text: string;
	}[];
	return JSON.parse(content[0]!.text);
};

export const createGraphDiscoveryFixtureFn = async () => {
	const harness = await createMcpHarness();
	const base = createJobTestConfig();
	const config = GameConfigSchema.parse({
		...base,
		meta: {
			...base.meta,
			id: "graph-discovery",
		},
		items: {
			puppy: {
				...base.items.forge,
				uid: "puppy",
				title: "Beagle Puppy",
				description: "PRIVATE_ITEM_DOCUMENT",
				lines: [
					{
						...base.items.forge!.lines[0],
						uid: "line:puppy:feed",
						title: "Feed Puppy",
						description: "PRIVATE_LINE_DOCUMENT",
						input: [
							{
								type: "materials",
								mode: "consume",
								quantity: {
									min: 1,
									max: 1,
								},
								query: {
									distance: "far",
									selector: {
										type: "item",
										itemUid: "fawn",
									},
								},
							},
						],
					},
				],
				merge: [
					{
						action: "consume",
						effect: "replace",
						target: {
							type: "item",
							itemUid: "fawn",
						},
						result: "paired",
					},
					{
						action: "use",
						effect: "keep",
						target: {
							type: "item",
							itemUid: "paired",
						},
					},
				],
			},
			fawn: {
				...base.items.water,
				uid: "fawn",
				title: "Fawn",
				merge: [
					{
						action: "use",
						effect: "replace",
						target: {
							type: "item",
							itemUid: "puppy",
						},
						result: "paired",
					},
				],
			},
			paired: {
				...base.items.tool,
				uid: "paired",
				title: "Beagle Puppy With Fawn",
			},
		},
	});
	await Effect.runPromise(
		harness.repository.createProjectFx({
			version: {
				major: 1,
				minor: 0,
			},
			config,
			resources: [],
		}),
	);
	harness.ownership.setProjectContextFn(config.meta.id);
	await Effect.runPromise(harness.ownership.startLocalFx);
	return {
		...harness,
		config,
		client: await connectMcpClient(harness.port),
	};
};

export const toolTextFn = (result: { content?: unknown; isError?: unknown }): string => {
	expect(result.isError).not.toBe(true);
	const content = result.content as {
		type: string;
		text: string;
	}[];
	expect(content).toHaveLength(1);
	return content[0]!.text;
};

/** Extract only the exact continuation/hydration tokens an MCP caller must be able to reuse. */
export const graphTextFn = (result: { content?: unknown; isError?: unknown }) => {
	const text = toolTextFn(result);
	const quoted = '"(?:\\\\.|[^"\\\\])*"';
	const headerFn = (name: string) => {
		const value = new RegExp(`^${name}: (${quoted})$`, "m").exec(text)?.[1];
		if (value === undefined) throw new Error(`Missing graph ${name} header.`);
		return JSON.parse(value) as string;
	};
	const idsFn = (name: string): string[] => [
		...new Set(
			[
				...text.matchAll(new RegExp(`${name}=(${quoted})`, "g")),
			].map((match) => JSON.parse(match[1]!)),
		),
	];
	const cursor = new RegExp(`^Cursor: (${quoted})$`, "m").exec(text)?.[1];
	const revision = /^Revision: (\d+)$/m.exec(text)?.[1];
	if (revision === undefined) throw new Error("Missing graph Revision header.");
	return {
		text,
		projectId: headerFn("Project"),
		revision: Number(revision),
		snapshotId: headerFn("Snapshot"),
		operationIds: idsFn("operationId"),
		edgeIds: idsFn("edgeId"),
		lineUids: idsFn("lineUid"),
		nextCursor: cursor === undefined ? undefined : (JSON.parse(cursor) as string),
	};
};
