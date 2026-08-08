import {
  createRuntimeState,
  canDispatch,
  markSent,
  markFailed,
  applyStopEvent,
  dueMessages
} from './outreach-sequence-state.mjs';

const failures = [];
function check(condition, message) {
  if (!condition) failures.push(message);
}

function makeManifest(sequenceCount = 5) {
  const messages = [];
  for (let s = 1; s <= sequenceCount; s += 1) {
    const sequenceKey = `sequence-${s}`;
    for (let touch = 1; touch <= 5; touch += 1) {
      messages.push({
        campaign_week: '2099-01-05',
        sequence_key: sequenceKey,
        message_key: `${sequenceKey}-touch-${touch}`,
        recipient_email: `recipient${s}@example.com`,
        scheduled_local_date: `2099-01-${String(4 + touch).padStart(2, '0')}`,
        scheduled_local_time: '09:30',
        scheduled_timezone: 'America/New_York',
        touch_number: touch,
        stop_on: ['reply', 'bounce', 'opt_out', 'manual_conversation'],
        send_status: 'planned'
      });
    }
  }
  return {
    campaign_week: '2099-01-05',
    generated_at: new Date().toISOString(),
    messages
  };
}

const manifest = makeManifest();
const state = createRuntimeState(manifest);
check(Object.keys(state.sequences).length === 5, 'runtime should contain five sequences');
check(Object.keys(state.messages).length === 25, 'runtime should contain 25 messages');

// Idempotent delivery: the same message key can be recorded as sent only once.
const first = manifest.messages.find((message) => message.sequence_key === 'sequence-1' && message.touch_number === 1);
check(canDispatch(state, first).allowed === true, 'initial message should be dispatchable');
check(markSent(state, first.message_key, 'provider-1').changed === true, 'first markSent should change state');
check(markSent(state, first.message_key, 'provider-1-again').changed === false, 'duplicate markSent should be idempotently ignored');
check(canDispatch(state, first).allowed === false, 'already sent message should not dispatch again');

// Reply stops all remaining planned touches.
applyStopEvent(state, 'sequence-1', 'reply');
for (const message of manifest.messages.filter((item) => item.sequence_key === 'sequence-1' && item.touch_number > 1)) {
  check(canDispatch(state, message).allowed === false, `reply should suppress sequence-1 touch ${message.touch_number}`);
  check(state.messages[message.message_key].status === 'suppressed', `reply should mark sequence-1 touch ${message.touch_number} suppressed`);
}
check(applyStopEvent(state, 'sequence-1', 'reply').changed === false, 'duplicate reply event should be idempotent');

// Bounce, opt-out and manual conversation each stop a different sequence.
for (const [sequenceKey, event] of [
  ['sequence-2', 'bounce'],
  ['sequence-3', 'opt_out'],
  ['sequence-4', 'manual_conversation']
]) {
  const touch1 = manifest.messages.find((message) => message.sequence_key === sequenceKey && message.touch_number === 1);
  markSent(state, touch1.message_key, `${sequenceKey}-provider-id`);
  const result = applyStopEvent(state, sequenceKey, event);
  check(result.changed === true, `${event} should stop ${sequenceKey}`);
  for (const message of manifest.messages.filter((item) => item.sequence_key === sequenceKey && item.touch_number > 1)) {
    check(canDispatch(state, message).allowed === false, `${event} should suppress ${sequenceKey} touch ${message.touch_number}`);
  }
}

// A provider failure does not become a sent message and cannot be retried blindly without explicit state handling.
const failed = manifest.messages.find((message) => message.sequence_key === 'sequence-5' && message.touch_number === 1);
check(markFailed(state, failed.message_key, 'simulated_provider_failure').changed === true, 'provider failure should be recorded');
check(canDispatch(state, failed).allowed === false, 'failed message should not be blindly dispatched again');

// dueMessages returns only active, unsent messages at or after their local time.
const cleanManifest = makeManifest(1);
const cleanState = createRuntimeState(cleanManifest);
const dueBefore = dueMessages(cleanState, cleanManifest, '2099-01-05', { 'America/New_York': '09:20' });
const dueAfter = dueMessages(cleanState, cleanManifest, '2099-01-05', { 'America/New_York': '09:35' });
check(dueBefore.length === 0, 'nothing should be due before scheduled local time');
check(dueAfter.length === 1 && dueAfter[0].touch_number === 1, 'touch 1 should be due after scheduled local time');
markSent(cleanState, dueAfter[0].message_key, 'provider-due-test');
check(dueMessages(cleanState, cleanManifest, '2099-01-05', { 'America/New_York': '09:35' }).length === 0, 'sent due message should not appear again');

if (failures.length) {
  console.error(`Provider lifecycle test failed with ${failures.length} issue(s):`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('Provider lifecycle safety test passed.');
