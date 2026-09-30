type PayloadRecord = Record<string, unknown>;

const payloadRecordIs = (value: unknown): value is PayloadRecord =>
	typeof value === "object" && value !== null && !Array.isArray(value);

export const atlasPayloadReasoningStatusRemove = (payload: unknown): unknown => {
	if (!payloadRecordIs(payload) || !Array.isArray(payload.input)) return payload;

	let statusRemoved = false;
	const input = payload.input.map((item) => {
		if (!payloadRecordIs(item) || item.type !== "reasoning" || !("status" in item)) return item;

		statusRemoved = true;
		const { status: _status, ...reasoningItem } = item;
		return reasoningItem;
	});

	return statusRemoved ? { ...payload, input } : payload;
};
