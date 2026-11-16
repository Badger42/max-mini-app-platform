/**
 * Domain types for the public Web + MAX adapter contract.
 *
 * Telegram is retained as a legacy implementation until the preceding
 * platform-migration stage is applied. New integrations should use only
 * `BridgeType` (`null` for Web or `max` for MAX).
 *
 * @typedef {null|'max'} BridgeType
 * @typedef {'telegram'} LegacyBridgeType
 * @typedef {'web'|'max'|'telegram'} LaunchContext
 * @typedef {'detected'|'not-detected'|'invalid'} LaunchDetectionStatus
 * @typedef {'ios'|'android'|'desktop'|'web'} MaxClientPlatform
 * @typedef {'DIALOG'|'CHAT'} MaxChatType
 * @typedef {'downloading'|'cancelled'} MaxDownloadPlatformStatus
 * @typedef {'accepted'|'cancelled'} TelegramDownloadPlatformStatus
 * @typedef {'shared'|'cancelled'} MaxSharePlatformStatus
 */

/**
 * A result from parsing a host's launch fragment. `invalid` means duplicate
 * protocol keys were present; it is not an authentication result.
 *
 * @typedef {Object} LaunchDetectionResult
 * @property {LaunchDetectionStatus} status
 * @property {boolean} isMaxLaunch
 * @property {MaxClientPlatform|null} platform
 * @property {string|null} version
 * @property {boolean} invalid
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
 * Legacy Telegram bridge shape. This is isolated from the canonical BridgeType
 * so the remaining migration can be removed without changing MAX contracts.
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
 * `opened` and browser-fallback `requested` are retained only for the legacy
 * Telegram implementation. Web and MAX return shared/cancelled/copied.
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
 *   bridgeType: BridgeType|LegacyBridgeType,
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
 * Options accepted by the platform selector. The legacy Telegram branch is
 * retained until the preceding migration stage is completed.
 * @typedef {Object} CreatePlatformOptions
 * @property {BridgeType|LegacyBridgeType|'web'} [bridgeType]
 * @property {MaxBridge|TelegramBridge|null} [bridge]
 * @property {Error|string|null} [error]
 * @property {DownloadOptions} [downloadOptions]
 */

export {}
