import assert from 'node:assert/strict';
import { test } from 'node:test';
import { validateTransactionAmount, parseExchangeRate } from '../src/lib/domain/transaction.ts';
import { projectBalanceHistory, projectGoalState } from '../src/lib/domain/account-aggregate.ts';

test('transaction amounts must be positive, safe whole cents', () => {
	for (const amount of [0, -1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
		assert.equal(validateTransactionAmount(amount), false, String(amount));
	}
	assert.equal(validateTransactionAmount(1), true);
	assert.equal(validateTransactionAmount(1250), true);
});

test('exchange rates require the entire input to be numeric', () => {
	for (const value of [null, '', ' ', '1.5oops', 'Infinity', 'NaN']) {
		assert.equal(parseExchangeRate(value), null, String(value));
	}
	assert.equal(parseExchangeRate(' 1.25 '), 1.25);
	assert.equal(parseExchangeRate('0'), 0);
});

test('balance history hydrates transaction dates from stored JSON payloads', () => {
	const events = [
		{
			id: 'created',
			streamId: 'account',
			eventType: 'AccountCreated',
			version: 1,
			occurredAt: new Date('2026-01-01T00:00:00Z'),
			payload: { initialBalance: 1000 }
		},
		{
			id: 'transaction',
			streamId: 'account',
			eventType: 'TransactionCreated',
			version: 2,
			occurredAt: new Date('2026-01-02T10:00:00Z'),
			payload: {
				transactionId: 'transaction',
				balanceAfter: 900,
				transactionDate: '2026-01-02T12:00:00+02:00'
			}
		}
	];
	const history = projectBalanceHistory(events);
	assert.ok(history[1].timestamp instanceof Date);
	assert.equal(history[1].timestamp.toISOString(), '2026-01-02T10:00:00.000Z');
	assert.equal(events[1].payload.transactionDate, '2026-01-02T12:00:00+02:00');
});

test('goal replay hydrates target dates and still permits clearing them', () => {
	const created = {
		streamId: 'goal',
		eventType: 'GoalSet',
		version: 1,
		occurredAt: new Date('2026-01-01T00:00:00Z'),
		payload: {
			accountId: 'account',
			name: 'Savings',
			targetAmount: 1000,
			targetDate: '2026-06-01T00:00:00Z'
		}
	};
	assert.equal(projectGoalState([created]).targetDate.toISOString(), '2026-06-01T00:00:00.000Z');
	assert.equal(
		projectGoalState([
			created,
			{
				eventType: 'GoalUpdated',
				version: 2,
				occurredAt: created.occurredAt,
				payload: { changes: { targetDate: null } }
			}
		]).targetDate,
		null
	);
});
