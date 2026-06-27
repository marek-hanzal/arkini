import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { ProducerProductLineView } from "~/v0/board/view/ProducerProductLineViewSchema";
import { ItemProducerProductLinesCard } from "~/v0/item/ui/ItemProducerProductLinesCard";

const createLine = (overrides: Partial<ProducerProductLineView> = {}): ProducerProductLineView => ({
	blocked: false,
	blockReasonEffectIds: [],
	durationMs: 5000,
	inProgress: true,
	inputItemIds: [],
	inputs: [],
	inputsAvailable: true,
	inputsReady: true,
	isDefault: true,
	missingRequirementItemIds: [],
	name: "Log",
	pausedAtMs: 1000,
	producerQueuedJobs: 1,
	productId: "product:lumberjack-t1:log",
	progress: 0.2,
	queueFull: true,
	queuedJobs: 1,
	queueSize: 1,
	readyAtMs: 5000,
	requirementItemIds: [],
	requirementsReady: false,
	startAtMs: 0,
	...overrides,
});

describe("ItemProducerProductLinesCard", () => {
	it("shows paused producer jobs with frozen remaining time", () => {
		const html = renderToStaticMarkup(
			<ItemProducerProductLinesCard
				items={{}}
				lines={[
					createLine(),
				]}
				nowMs={10_000}
				pending={false}
				onSetDefault={() => undefined}
				onStart={() => undefined}
				onWithdrawInput={() => undefined}
			/>,
		);

		expect(html).toContain("Paused");
		expect(html).toContain("4s");
		expect(html).not.toContain("Queue full</button>");
	});
});
