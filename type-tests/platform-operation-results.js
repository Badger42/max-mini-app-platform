/** @type {import('../src/platform/platformTypes.js').ShareUrlResult} */
const copiedResult = { status: 'copied' }

/** @type {import('../src/platform/platformTypes.js').DownloadResult} */
// @ts-expect-error A clipboard result is not a download result.
const invalidDownloadResult = copiedResult

/** @type {import('../src/platform/platformTypes.js').ShareUrlResult} */
const openedLinkResult = { status: 'opened' }

/** @type {import('../src/platform/platformTypes.js').PreparedMessageResult} */
// @ts-expect-error Link-opening outcomes are not prepared-message outcomes.
const invalidPreparedMessageResult = openedLinkResult

void invalidDownloadResult
void invalidPreparedMessageResult

/** @type {import('../src/platform/platformTypes.js').DownloadResult} */
// @ts-expect-error A cancelled platform result cannot be represented as requested.
const invalidCorrelatedDownload = { status: 'requested', platformStatus: 'cancelled' }

void invalidCorrelatedDownload

/** @type {import('../src/platform/platformTypes.js').BridgeType} */
const currentBridgeType = 'max'

/** @type {import('../src/platform/platformTypes.js').BridgeType} */
// @ts-expect-error Telegram is retained only in the explicitly legacy type.
const invalidCurrentBridgeType = 'telegram'

void currentBridgeType
void invalidCurrentBridgeType
