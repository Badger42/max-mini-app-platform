/**
 * @typedef {'max'|'telegram'|null} BridgeType
 */

/**
 * `shareUrl` describes the effective public operation (native or browser
 * fallback). The `native*` fields describe host-SDK support only.
 *
 * @typedef {Object} PlatformCapabilities
 * @property {boolean} nativeDownload
 * @property {boolean} backButton
 * @property {boolean} nativeExternalLinks
 * @property {boolean} nativePlatformLinks
 * @property {boolean} closingConfirmation
 * @property {boolean} shareUrl
 * @property {boolean} sharePreparedMessage
 */

/**
 * @typedef {'requested'|'cancelled'|'shared'|'opened'|'copied'|'unavailable'} OperationStatus
 */

/**
 * @typedef {Object} PlatformOperationResult
 * @property {OperationStatus} status
 * @property {string} [platformStatus] Original platform status when normalized.
 */

/**
 * @typedef {Object} PlatformRuntime
 * @property {string|null} clientPlatform Host-reported client platform.
 * @property {string|null} clientVersion Host-reported SDK/client version.
 * @property {string|null} deviceName Host-reported device name, if available.
 * @property {{userAgent: string|null}} [browser] Browser diagnostic data.
 */

/**
 * @typedef {Object} PlatformAdapter
 * @property {BridgeType} bridgeType
 * @property {boolean} bridgeAvailable
 * @property {Error|null} bridgeError
 * @property {PlatformRuntime} runtime
 * @property {PlatformCapabilities} capabilities
 * @property {(url: string, fileName: string, options?: object) => Promise<PlatformOperationResult>} downloadFile
 * @property {(url: string) => PlatformOperationResult} openExternalLink
 * @property {(url: string) => PlatformOperationResult} openPlatformLink
 * @property {(url: string, text?: string) => Promise<PlatformOperationResult>} shareUrl
 * @property {(params: object) => Promise<PlatformOperationResult>} sharePreparedMessage
 * @property {{supported: boolean, show: Function, hide: Function, onClick: Function}} backButton
 * @property {() => void|Promise<void>} enableClosingConfirmation
 * @property {() => void|Promise<void>} disableClosingConfirmation
 * @property {() => void|Promise<void>} ready
 */
export {}
