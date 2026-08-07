export const STOP_EVENTS = new Set(['reply', 'bounce', 'opt_out', 'manual_conversation']);

export function createRuntimeState(manifest) {
  const sequences = {};
  const messages = {};

  for (const message of manifest.messages ?? []) {
    if (!message.sequence_key || !message.message_key) throw new Error('Manifest message is missing sequence_key or message_key.');
    if (messages[message.message_key]) throw new Error(`Duplicate message_key ${message.message_key}.`);

    if (!sequences[message.sequence_key]) {
      sequences[message.sequence_key] = {
        sequence_key: message.sequence_key,
        recipient_email: message.recipient_email,
        status: 'active',
        stop_reason: null,
        stopped_at: null,
        sent_message_keys: [],
        provider_message_ids: {}
      };
    }

    messages[message.message_key] = {
      message_key: message.message_key,
      sequence_key: message.sequence_key,
      touch_number: message.touch_number,
      status: 'planned',
      provider_message_id: null,
      sent_at: null,
      failed_at: null,
      failure_reason: null
    };
  }

  return {
    schema_version: 1,
    campaign_week: manifest.campaign_week,
    manifest_generated_at: manifest.generated_at,
    sequences,
    messages,
    events: []
  };
}

export function canDispatch(state, message) {
  const sequence = state.sequences?.[message.sequence_key];
  const runtimeMessage = state.messages?.[message.message_key];
  if (!sequence || !runtimeMessage) return { allowed: false, reason: 'unknown_message' };
  if (sequence.status !== 'active') return { allowed: false, reason: `sequence_${sequence.status}` };
  if (runtimeMessage.status === 'sent') return { allowed: false, reason: 'already_sent' };
  if (runtimeMessage.status === 'suppressed') return { allowed: false, reason: 'suppressed' };
  if (runtimeMessage.status === 'failed') return { allowed: false, reason: 'failed' };
  return { allowed: true, reason: null };
}

export function markSent(state, messageKey, providerMessageId, sentAt = new Date().toISOString()) {
  const runtimeMessage = state.messages?.[messageKey];
  if (!runtimeMessage) throw new Error(`Unknown message_key ${messageKey}.`);
  const sequence = state.sequences?.[runtimeMessage.sequence_key];
  if (!sequence) throw new Error(`Unknown sequence_key ${runtimeMessage.sequence_key}.`);

  if (runtimeMessage.status === 'sent') {
    return { changed: false, reason: 'already_sent' };
  }
  if (sequence.status !== 'active') {
    runtimeMessage.status = 'suppressed';
    return { changed: false, reason: `sequence_${sequence.status}` };
  }

  runtimeMessage.status = 'sent';
  runtimeMessage.provider_message_id = providerMessageId ?? null;
  runtimeMessage.sent_at = sentAt;
  if (!sequence.sent_message_keys.includes(messageKey)) sequence.sent_message_keys.push(messageKey);
  if (providerMessageId) sequence.provider_message_ids[messageKey] = providerMessageId;
  state.events.push({ type: 'sent', message_key: messageKey, sequence_key: runtimeMessage.sequence_key, at: sentAt });
  return { changed: true, reason: null };
}

export function markFailed(state, messageKey, failureReason, failedAt = new Date().toISOString()) {
  const runtimeMessage = state.messages?.[messageKey];
  if (!runtimeMessage) throw new Error(`Unknown message_key ${messageKey}.`);
  if (runtimeMessage.status === 'sent') return { changed: false, reason: 'already_sent' };
  runtimeMessage.status = 'failed';
  runtimeMessage.failed_at = failedAt;
  runtimeMessage.failure_reason = failureReason ?? 'provider_failure';
  state.events.push({ type: 'failed', message_key: messageKey, sequence_key: runtimeMessage.sequence_key, at: failedAt, reason: runtimeMessage.failure_reason });
  return { changed: true, reason: null };
}

export function applyStopEvent(state, sequenceKey, type, at = new Date().toISOString(), metadata = {}) {
  if (!STOP_EVENTS.has(type)) throw new Error(`Unsupported stop event ${type}.`);
  const sequence = state.sequences?.[sequenceKey];
  if (!sequence) throw new Error(`Unknown sequence_key ${sequenceKey}.`);

  if (sequence.status === 'stopped') {
    return { changed: false, reason: sequence.stop_reason };
  }

  sequence.status = 'stopped';
  sequence.stop_reason = type;
  sequence.stopped_at = at;

  for (const runtimeMessage of Object.values(state.messages ?? {})) {
    if (runtimeMessage.sequence_key !== sequenceKey) continue;
    if (runtimeMessage.status === 'planned') runtimeMessage.status = 'suppressed';
  }

  state.events.push({ type, sequence_key: sequenceKey, at, metadata });
  return { changed: true, reason: type };
}

export function dueMessages(state, manifest, localDate, localTimeByTimezone = {}) {
  return (manifest.messages ?? []).filter((message) => {
    const dispatch = canDispatch(state, message);
    if (!dispatch.allowed) return false;
    if (message.scheduled_local_date !== localDate) return false;
    const currentLocalTime = localTimeByTimezone[message.scheduled_timezone];
    if (!currentLocalTime) return false;
    return currentLocalTime >= message.scheduled_local_time;
  });
}
