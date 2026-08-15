const { Expo } = require('expo-server-sdk');
const User = require('../models/User');

// Pinned to the 3.x line deliberately, not the latest major: expo-server-sdk 5+ rewrote itself
// as ESM-only and pulled in a modern `undici` (their own dependency, not Node's built-in one)
// that assumes Node 20+ runtime globals/language features (`File`, `String.prototype.
// toWellFormed`, ...). This project's actual deployed runtime is node:18-alpine (see
// backend/Dockerfile) - a newer major crashes there on require() and again on the first real
// send, even though `node --check` and a local run against a newer host Node both pass cleanly.
// 3.15.0 is the last version before that rewrite: plain CommonJS, same `Expo` class API
// (isExpoPushToken/chunkPushNotifications/sendPushNotificationsAsync/
// chunkPushNotificationReceiptIds/getPushNotificationReceiptsAsync), verified against the
// package source before pinning - not just assumed compatible.
const expo = new Expo();

// Expo says receipts aren't reliably available until some time after the ticket is issued -
// their own docs example waits before checking. 15 minutes is comfortably inside their
// documented "receipts expire after 1 day" retention window while still catching stale/uninstalled
// tokens promptly enough to stop wasting sends on them.
const RECEIPT_CHECK_DELAY_MS = 15 * 60 * 1000;

// @desc   Best-effort Expo push delivery for one or more messages. Never throws past this
//         function - see notificationService.js's deliverNotifications, which already wraps
//         this in a log-only try/catch, same discipline as the rest of the codebase.
// @param  messages  a single {pushToken, title, body, data, userId?} or an array of them.
//                    `userId` is optional and only used so a later DeviceNotRegistered receipt
//                    can clear that user's stale pushToken - callers that don't care about
//                    cleanup can omit it.
//         A user who hasn't granted push permission simply has pushToken: null - that's an
//         expected, common case (not an error), so missing/invalid tokens are skipped silently.
async function sendPushNotifications(messages) {
  const candidates = (Array.isArray(messages) ? messages : [messages]).filter(Boolean);

  const valid = candidates.filter((m) => m.pushToken && Expo.isExpoPushToken(m.pushToken));
  if (valid.length === 0) return [];

  const expoMessages = valid.map((m) => ({
    to: m.pushToken,
    sound: 'default',
    title: m.title,
    body: m.body,
    data: m.data || {}
  }));

  const chunks = expo.chunkPushNotifications(expoMessages);
  const tickets = [];

  for (const chunk of chunks) {
    try {
      const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
      tickets.push(...ticketChunk);
    } catch (error) {
      console.error('Push notification send failed for a chunk:', error.message);
    }
  }

  // chunkPushNotifications/sendPushNotificationsAsync preserve message order within and across
  // chunks, and Expo returns exactly one ticket per message, so tickets[i] <-> valid[i] lines up.
  // Ticket-level errors (bad request shape, rate limiting, ...) surface immediately; per-device
  // delivery errors (DeviceNotRegistered, MessageTooBig, ...) only show up later via receipts.
  const ticketIdToUserId = {};
  tickets.forEach((ticket, i) => {
    if (ticket.status === 'error') {
      console.error(`Push ticket error for token ${valid[i].pushToken}: ${ticket.message}`, ticket.details || '');
    } else if (ticket.status === 'ok' && ticket.id && valid[i].userId) {
      ticketIdToUserId[ticket.id] = valid[i].userId;
    }
  });

  const ticketIds = Object.keys(ticketIdToUserId);
  if (ticketIds.length > 0) {
    const timer = setTimeout(() => {
      checkPushReceipts(ticketIds, ticketIdToUserId).catch((error) =>
        console.error('Push receipt check failed:', error.message)
      );
    }, RECEIPT_CHECK_DELAY_MS);
    // Don't let this deferred check keep the Node process alive on its own (e.g. during tests or
    // a clean shutdown) - unref is unavailable in some non-Node timer polyfills, guard defensively.
    if (typeof timer.unref === 'function') timer.unref();
  }

  return tickets;
}

// @desc   Fetches delivery receipts for previously-sent tickets and clears `pushToken` for any
//         user whose device reports DeviceNotRegistered, so future notifications stop wasting a
//         send on a dead token. Scheduled via setTimeout above rather than a real job queue -
//         this codebase has no job scheduler infra yet; an in-process timer is lost on restart,
//         which is an acceptable gap for this pass (the next send's ticket error, if any, would
//         still surface in logs).
async function checkPushReceipts(ticketIds, ticketIdToUserId) {
  const receiptIdChunks = expo.chunkPushNotificationReceiptIds(ticketIds);

  for (const chunk of receiptIdChunks) {
    try {
      const receipts = await expo.getPushNotificationReceiptsAsync(chunk);
      for (const receiptId of Object.keys(receipts)) {
        const receipt = receipts[receiptId];
        if (receipt.status !== 'error') continue;

        console.error(`Push receipt error (${receiptId}): ${receipt.message}`, receipt.details || '');

        if (receipt.details && receipt.details.error === 'DeviceNotRegistered') {
          const userId = ticketIdToUserId[receiptId];
          if (userId) {
            await User.findByIdAndUpdate(userId, { pushToken: null }).catch((error) =>
              console.error(`Failed to clear stale pushToken for user ${userId}:`, error.message)
            );
          }
        }
      }
    } catch (error) {
      console.error('Push receipt chunk fetch failed:', error.message);
    }
  }
}

module.exports = { sendPushNotifications };
