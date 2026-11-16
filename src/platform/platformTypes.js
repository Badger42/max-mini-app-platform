/**
 * @typedef {'web'|'max'} PlatformType
 * @typedef {null|'max'} BridgeType
 * @typedef {'valid'|'absent'|'invalid'|'conflicting'} LaunchDetectionStatus
 * @typedef {'requested'|'cancelled'|'shared'|'copied'|'unavailable'} OperationStatus
 */

/** @typedef {{ platform: ('ios'|'android'|'desktop'|'web'|null), version: (string|null) }} LaunchMetadata */

/**
 * Sanitized environment information. Raw WebAppData is deliberately excluded.
 * A malformed MAX launch fails closed to type='web' with a diagnostic status.
 *
 * @typedef {Object} LaunchContext
 * @property {PlatformType} type
 * @property {LaunchMetadata|null} launch
 * @property {{status: LaunchDetectionStatus, reason: (string|null)}} detection
 */

/**
 * `shareUrl` describes effective public availability (native or browser
 * fallback); the `native*` fields describe MAX SDK support only.
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
 * @typedef {Object} PlatformOperationResult
 * @property {OperationStatus} status
 * @property {string} [platformStatus] Original MAX status when normalized.
 */

/**
 * @typedef {Object} PlatformRuntime
 * @property {string|null} clientPlatform Host-reported or launch-reported client platform.
 * @property {string|null} clientVersion Host-reported or launch-reported version.
 * @property {string|null} deviceName Host-reported device name, if available.
 * @property {{userAgent: string|null}} [browser] Browser diagnostic data.
 */

/**
 * @typedef {Object} PlatformServices
 * @property {(url: string, fileName: string, options?: object) => Promise<unknown>} [downloadFile]
 */

/**
 * @typedef {Object} PlatformAdapter
 * @property {BridgeType} bridgeType null for Web, 'max' for MAX.
 * @property {boolean} bridgeAvailable
 * @property {Error|null} bridgeError
 * @property {LaunchContext} launchContext
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
