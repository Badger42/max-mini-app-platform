/**
 * Domain types for the public Web, MAX and Telegram adapter contract.
 *
 * `null` represents regular Web. MAX and Telegram are first-class supported
 * host platforms; neither is a legacy-only compatibility path.
 *
 * @typedef {null|'max'|'telegram'} BridgeType
 * @typedef {'web'|'max'|'telegram'} LaunchContext
 * @typedef {'detected'|'not-detected'|'invalid'} LaunchDetectionStatus
 * @typedef {'ios'|'android'|'desktop'|'web'} MaxClientPlatform
 * @typedef {'DIALOG'|'CHAT'} MaxChatType
 * @typedef {'downloading'|'cancelled'} MaxDownloadPlatformStatus
 * @typedef {'accepted'|'cancelled'} TelegramDownloadPlatformStatus
 * @typedef {'shared'|'cancelled'} MaxSharePlatformStatus
 */

/**
 * A normalized launch-detection outcome. This is a domain result shape; the
 * platform-specific parsers below intentionally retain their own SDK fields.
 * @typedef {Object} LaunchDetectionResult
 * @property {LaunchContext} context
 * @property {LaunchDetectionStatus} status
 *
 * @typedef {Object} MaxLaunchParseResult
 * @property {LaunchDetectionStatus} status
 * @property {boolean} isMaxLaunch
 * @property {MaxClientPlatform|null} platform
 * @property {string|null} version
 * @property {boolean} invalid Duplicate protocol keys were found.
 *
 * @typedef {Object} TelegramLaunchParseResult
 * @property {boolean} isTelegramLaunch
 * @property {string|null} platform
 * @property {string|null} version
 * @property {boolean} invalid Duplicate protocol keys were found.
 */

/** @typedef {Object} DownloadOptions
 * @property {RequestCredentials} [credentials]
 * @property {number} [revokeDelayMs]
 */

/** @typedef {Object} PlatformAdapterOptions
 * @property {DownloadOptions} [downloadOptions]
 */

/**
 * MAX's text/link and prepared-message forms are mutually exclusive according
 * to the MAX Bridge API.
 *
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
 * Native MAX back button methods used by the adapter.
 * @typedef {Object} NativeBackButton
 * @property {() => void} show
 * @property {() => void} hide
 * @property {(handler: () => void) => void} onClick
 * @property {(handler: () => void) => void} offClick
 */

/**
 * Minimal, deliberately structural view of the documented MAX WebApp surface
 * consumed by this package. Optional members are capability-detected.
 * @typedef {Object} MaxBridge
 * @property {MaxClientPlatform} [platform]
 * @property {string} [version]
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

/**
 * Telegram's share composer can be opened through the host link API or a
 * browser fallback; those outcomes are distinct from a completed share.
 * @typedef {Object} ShareUrlResult
 * @property {'shared'|'cancelled'|'copied'|'opened'|'requested'|'unavailable'} status
 */

/** @typedef {Object} PreparedMessageResult
 * @property {'shared'|'cancelled'} status
 */

/** @typedef {Object} PlatformRuntime
 * @property {string|null} clientPlatform Host-reported platform.
 * @property {string|null} clientVersion Host-reported client version.
 * @property {string|null} deviceName Host-reported device name, if available.
 * @property {{userAgent: string|null}} [browser] Browser diagnostics.
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
 * Public service surface shared by platform adapters.
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
 *   runtime: PlatformRuntime,
 *   capabilities: PlatformCapabilities,
 *   downloadFile: (url: string, fileName: string, options?: DownloadOptions) => Promise<DownloadResult>,
 *   openExternalLink: (url: string) => LinkOpenResult,
 *   openPlatformLink: (url: string) => LinkOpenResult,
 *   shareUrl: (url: string, text?: string) => Promise<ShareUrlResult>,
 *   sharePreparedMessage: (params?: PreparedMessageInput) => Promise<PreparedMessageResult>
 * }} PlatformAdapter
 */

/**
 * Options accepted by the platform selector.
 * @typedef {Object} CreatePlatformOptions
 * @property {BridgeType|'web'} [bridgeType]
 * @property {MaxBridge|TelegramBridge|null} [bridge]
 * @property {Error|string|null} [error]
 * @property {DownloadOptions} [downloadOptions]
 */

export {}
