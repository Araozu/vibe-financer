ALTER TABLE "transaction" ADD COLUMN IF NOT EXISTS "destination_amount" integer;

UPDATE "transaction" AS t
SET "destination_amount" = (
	SELECT (e.payload->>'destinationAmount')::integer
	FROM "event_store" AS e
	WHERE e.event_type = 'TransferCreated'
		AND e.payload->>'transactionId' = t.id
	LIMIT 1
)
WHERE t.type = 'transfer'
	AND t."destination_amount" IS NULL;
