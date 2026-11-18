/**
 * Domain types for the Web, MAX and Telegram adapter contracts.
 *
 * @typedef {null|'max'|'telegram'} BridgeType
 * @typedef {{startParam: string|null}} LaunchParameters
 * @typedef {'web'|'max'|'telegram'} LaunchContextType
 * @typedef {'valid'|'absent'|'invalid'|'conflicting'} LaunchDetectionStatus
 * @typedef {'ios'|'android'|'desktop'|'web'} MaxClientPlatform
 * @typedef {'DIALOG'|'CHAT'} MaxChatType
 * @typedef {'downloading'|'cancelled'} MaxDownloadPlatformStatus
 * @typedef {'accepted'|'cancelled'} TelegramDownloadPlatformStatus
 * @typedef {'shared'|'cancelled'} MaxSharePlatformStatus
 */

/**
 * Sanitized launch context. Raw MAX WebAppData and Telegram init data are never
 * exposed here and this object must never be used as an authentication result.
 * @typedef {Object} LaunchContext
 * @property {LaunchContextType} type
 * @property {{platform: string|null, version: string|null}|null} launch
 * @property {{status: LaunchDetectionStatus, reason: string|null}} detection
 */

/** @typedef {Object} LaunchDetectionResult
 * @property {LaunchContextType} context
 * @property {LaunchDetectionStatus} status
 */

/** @typedef {Object} MaxLaunchParseResult
 * @property {'detected'|'not-detected'|'invalid'} status
 * @property {boolean} isMaxLaunch
 * @property {MaxClientPlatform|null} platform
 * @property {string|null} version
 * @property {boolean} invalid
 */

/** @typedef {Object} TelegramLaunchParseResult
 * @property {boolean} isTelegramLaunch
 * @property {string|null} platform
 * @property {string|null} version
 * @property {boolean} invalid
 */

/** @typedef {{credentials?: RequestCredentials, revokeDelayMs?: number} & Record<string, unknown>} DownloadOptions */

/**
 * Injected service contract. The service owns HTTP client configuration,
 * credentials, CORS, Blob saving and application-specific URL handling.
 * @callback DownloadService
 * @param {string} url
 * @param {string} fileName
 * @param {Record<string, unknown>} options
 * @returns {unknown|Promise<unknown>}
 */

/** @typedef {Object} DownloadServices
 * @property {DownloadService} [downloadFile]
 */

/** @typedef {Object} PlatformAdapterOptions
 * @property {DownloadOptions} [downloadOptions]
 * @property {DownloadServices} [services]
 * @property {LaunchContext|null} [launchContext]
 */

/**
 * MAX's text/link and prepared-message forms are mutually exclusive according
 * to the MAX Bridge API.
 * @typedef {{text?: string, link: string, mid?: never, chatType?: never}} MaxTextShareRequest
 * @typedef {{mid: string, chatType: MaxChatType, link?: never, text?: never}} MaxPreparedShareRequest
 * @typedef {MaxTextShareRequest|MaxPreparedShareRequest} MaxShareContentRequest
 * @typedef {{messageId: string, chatType: MaxChatType}} MaxPreparedMessageInput
 * @typedef {{messageId: string}} TelegramPreparedMessageInput
 * @typedef {MaxPreparedMessageInput|TelegramPreparedMessageInput} PreparedMessageInput
 * @typedef {{status: MaxSharePlatformStatus}} MaxShareContentResponse
 * @typedef {{status: MaxSharePlatformStatus}} MaxShareUrlResult
 * @typedef {{status: MaxSharePlatformStatus}} MaxPreparedMessageResult
 */

/** @typedef {{status: MaxDownloadPlatformStatus}} MaxDownloadResponse */

/**
 * Native MAX/Telegram BackButton methods used by the adapters.
 * @typedef {Object} NativeBackButton
 * @property {() => void} show
 * @property {() => void} hide
 * @property {(handler: () => void) => void} onClick
 * @property {(handler: () => void) => void} offClick
 */

/**
 * Minimal structural view of the MAX WebApp surface consumed by this package.
 * Optional members are capability-detected.
 * @typedef {Object} MaxBridge
 * @property {MaxClientPlatform} [platform]
 * @property {string} [version]
 * @property {{start_param?: string}} [initDataUnsafe]
 * @property {string} [deviceName]
 * @property {(url: string, fileName: string) => Promise<MaxDownloadResponse>} [downloadFile]
 * @property {(url: string) => void} [openLink]
 * @property {(url: string) => void} [openMaxLink]
 * @property {(params: MaxShareContentRequest) => Promise<MaxShareContentResponse>} [shareMaxContent]
 * @property {NativeBackButton} [BackButton]
 * @property {() => void} [enableClosingConfirmation]
 * @property {() => void} [disableClosingConfirmation]
 */

/**
 * Telegram bridge surface consumed by the first-class Telegram adapter.
 * @typedef {Object} TelegramBridge
 * @property {string} [platform]
 * @property {string} [version]
 * @property {{start_param?: string}} [initDataUnsafe]
 * @property {NativeBackButton} [BackButton]
 * @property {(params: {url: string, file_name: string}, callback: (accepted: boolean) => void) => void} [downloadFile]
 * @property {(messageId: string, callback: (sent: boolean) => void) => void} [shareMessage]
 * @property {(url: string) => void} [openLink]
 * @property {(url: string) => void} [openTelegramLink]
 * @property {(version: string) => boolean} [isVersionAtLeast]
 * @property {() => void} [enableClosingConfirmation]
 * @property {() => void} [disableClosingConfirmation]
 * @property {() => void} [ready]
 */

/**
 * @typedef {Object} PlatformCapabilities
 * @property {boolean} nativeDownload Host SDK can perform a download in this context.
 * @property {boolean} backButton Complete native BackButton API is available.
 * @property {boolean} nativeExternalLinks Host SDK exposes its external-link API.
 * @property {boolean} nativePlatformLinks Host SDK exposes its host-deep-link API.
 * @property {boolean} closingConfirmation Both native confirmation methods exist.
 * @property {boolean} nativeShareUrl Host SDK exposes its native URL/text sharing API.
 * @property {boolean} shareUrl URL sharing is available through native or browser fallback.
 * @property {boolean} sharePreparedMessage Native prepared-message sharing is available.
 */

/** @typedef {Object} DownloadRequestedResult
 * @property {'requested'} status Request accepted/started; never means completed.
 * @property {'downloading'|'accepted'} [platformStatus]
 */
/** @typedef {Object} DownloadCancelledResult
 * @property {'cancelled'} status
 * @property {'cancelled'} [platformStatus]
 */
/** @typedef {DownloadRequestedResult|DownloadCancelledResult} DownloadResult */

/**
 * A link opener reports that an opening request was issued, not that a browser
 * window or host screen was successfully displayed.
 * @typedef {Object} LinkOpenResult
 * @property {'requested'|'unavailable'} status
 */

/** @typedef {Object} ShareUrlResult
 * @property {'shared'|'cancelled'|'copied'|'opened'|'requested'|'unavailable'} status
 */
/** @typedef {Object} PreparedMessageResult
 * @property {'shared'|'cancelled'} status
 */

/** @typedef {Object} PlatformRuntime
 * @property {string|null} clientPlatform Host-reported platform.
 * @property {string|null} clientVersion Host-reported client version.
 * @property {string|null} deviceName Host-reported device name, if available.
 * @property {{userAgent: string|null}} [browser]
 * @property {string|null} [platform]
 * @property {string|null} [version]
 */

/** @typedef {Object} BackButtonService
 * @property {boolean} supported
 * @property {() => void} show
 * @property {() => void} hide
 * @property {(handler: () => void|Promise<void>) => (() => void)} onClick
 */

/**
 * Common methods exposed by every adapter.
 * @typedef {Object} PlatformServices
 * @property {BackButtonService} backButton
 * @property {() => void|Promise<void>} enableClosingConfirmation
 * @property {() => void|Promise<void>} disableClosingConfirmation
 * @property {() => void|Promise<void>} ready
 */

/**
 * @typedef {PlatformServices & {
 *   bridgeType: BridgeType,
 *   bridgeAvailable: boolean,
 *   bridgeError: Error|null,
 *   launchContext: LaunchContext|null,
 *   launchParameters: LaunchParameters,
 *   runtime: PlatformRuntime,
 *   capabilities: PlatformCapabilities,
 *   downloadFile: (url: string, fileName: string, options?: DownloadOptions) => Promise<DownloadResult>,
 *   openExternalLink: (url: string) => LinkOpenResult,
 *   openPlatformLink: (url: string) => LinkOpenResult,
 *   shareUrl: (url: string, text?: string) => Promise<ShareUrlResult>,
 *   sharePreparedMessage: (params?: PreparedMessageInput) => Promise<PreparedMessageResult>
 * }} PlatformAdapter
 */

/** @typedef {Object} CreatePlatformOptions
 * @property {BridgeType|'web'} [bridgeType]
 * @property {MaxBridge|TelegramBridge|null} [bridge]
 * @property {Error|string|null} [error]
 * @property {Error|string|null} [bridgeError]
 * @property {LaunchContext|null} [launchContext]
 * @property {DownloadOptions} [downloadOptions]
 * @property {DownloadServices} [services]
 */

export {}
