# Task: Adapt an Existing Vue 3 Application for MAX Mini Apps

Adapt the existing Vue 3 application to support MAX Mini Apps while preserving its current architecture and full functionality as a regular web application.

## 1. Project Background

- Vue 3.
- Vue CLI (Webpack), not Vite.
- All components use the Options API.
- Vue Router.
- Axios for HTTP requests.
- Backend built with C# / ASP.NET Core.
- Frontend and backend are hosted on separate domains.
- Authentication is already implemented using the existing HttpOnly Cookie-based system.
- The application uses custom Vue modal windows and possibly a third-party modal plugin.
- The application has its own color scheme and CSS.

## 2. Core Architectural Requirements

### 2.1. Overall Architecture

Preserve a single codebase for two runtime environments:

1. A regular web browser.
2. MAX Mini App.

Do not create a separate Vue application for MAX.

Introduce a separate Platform Adapter that hides differences between the browser and MAX.

All new Vue components must use the Options API. Do not migrate existing components to the Composition API.

Do not rewrite Axios, Vue Router, or existing services unless there is an objective technical reason.

### 2.2. Colors and Design

The application's existing color schemes and design must remain unchanged.

Do not:
- Switch to MAX UI.
- Use MAX system color schemes.
- Automatically switch between light and dark themes.
- Rewrite existing CSS variables.
- Change the colors of buttons, backgrounds, text, or other UI elements.

Allow only targeted CSS adjustments required for correct rendering inside the WebView, such as viewport height, Safe Area, fixed elements, scrolling, keyboard behavior, and modal windows.

## 3. MAX Bridge Integration

Use the official MAX Bridge:

`https://st.max.ru/js/max-web-app.js`

**Critical requirement: do not include the Bridge as a static script in `public/index.html`.**

Implement conditional, dynamic loading:

1. Detect whether the application was launched inside MAX.
2. If it was opened in a regular browser, use the Web Adapter immediately. Do not make requests to the MAX CDN.
3. If it was opened inside MAX, dynamically add the `<script>` element to the DOM.
4. Wait for the script's load event.
5. Check whether `window.WebApp` is available.
6. Use the MAX Adapter if loading succeeds.
7. If loading fails, the CDN is blocked, or a timeout occurs, use the MAX Fallback Adapter.

Use the documented MAX launch mechanism to detect the runtime environment.

Do not use User-Agent as the primary way to detect MAX.

Do not use `initDataUnsafe` for authentication or user verification.

Verify:
- Exactly how MAX provides launch parameters.
- Whether they conflict with the application's current Vue Router mode.
- How to handle missing or invalid launch parameters.

If the application uses `createWebHashHistory()`, explicitly address the conflict with the URL fragment used by MAX.

### 3.1. Bridge Loader

Create a separate `loadMaxBridge.js` module.

Requirements:
- Asynchronous loading.
- A configurable timeout of approximately 5 seconds.
- Protection against loading the same script more than once.
- Handling of `onload` and `onerror`.
- Verification that `window.WebApp` exists after loading.
- Protection against the script loading after the timeout has already fired.
- The ability to retry after an explicit retry action.

A Bridge loading failure must not prevent Vue from starting.

Do not switch adapters automatically in the middle of the application's lifecycle.

## 4. Platform Adapter

Use the following structure as a starting point:

```text
src/
  platform/
    detectMaxLaunch.js
    loadMaxBridge.js
    platform.js
    maxAdapter.js
    webAdapter.js
    maxFallbackAdapter.js
    downloadBlob.js
    navigation.js

  plugins/
    platform.js

  services/
    files.js
```

The structure may be adjusted if doing so improves the architecture.

### 4.1. platform.js

This factory receives the result of environment detection and Bridge loading, then returns the appropriate adapter.

Support three states:

| State | Adapter |
|---|---|
| Regular browser | Web Adapter |
| MAX + Bridge available | MAX Adapter |
| MAX + Bridge unavailable | MAX Fallback Adapter |

Provide a common interface implemented by all adapters.

Prefer using `capabilities` to indicate whether a specific feature is available instead of checking `isMax` in components.

For example:

```js
this.$platform.capabilities.nativeDownload
this.$platform.capabilities.backButton
this.$platform.bridgeAvailable
```

Do not allow methods to be missing from one of the adapters and cause unhandled errors.

### 4.2. MAX Adapter

Implement wrappers for the MAX Bridge features that are actually needed:

- `downloadFile(url, fileName)`.
- `openExternalLink(url)`.
- `openMaxLink(url)`.
- `backButton.show()`.
- `backButton.hide()`.
- `backButton.onClick(handler)`.
- `enableClosingConfirmation()`.
- `disableClosingConfirmation()`.

Also expose runtime information such as platform, version, and device, when available through the documented API.

Do not implement unused MAX Bridge features in advance.

### 4.3. Web Adapter

Provide browser implementations of the common interface.

For file downloads, use the application's existing implementation if it already uses Axios and Blob.

For MAX methods that have no browser equivalent, provide safe no-op implementations or explicitly indicate that the feature is unavailable.

### 4.4. MAX Fallback Adapter

Use this adapter when MAX launch parameters are detected but the Bridge cannot be loaded.

The application must continue to work.

In this mode:
- Vue Router remains available.
- Axios remains available.
- Existing authentication remains available, provided the cookies work.
- Modal windows continue to work.
- Downloads use the fallback Blob mechanism.
- MAX BackButton is unavailable.
- Native closing confirmation is unavailable.

Do not treat this state as a regular browser: the application was launched from MAX, but Bridge access was not obtained.

## 5. Vue Plugin and Options API

Create a Vue Plugin that registers the adapter as:

```js
this.$platform
```

Register it in `main.js`.

Implement an asynchronous bootstrap sequence:

1. Detect the runtime environment.
2. Load MAX Bridge if necessary.
3. Create the appropriate adapter.
4. Register the Vue Plugin.
5. Call `app.mount()`.

A regular browser must not wait for the MAX CDN.

If Bridge loading fails, the application must still mount.

## 6. File Downloads — A Separate, Important Requirement

The existing C# backend generates PDFs and other files.

Preserve the current download mechanism in the regular web application.

### 6.1. Downloads Inside MAX

Use the documented method:

```js
window.WebApp.downloadFile(url, fileName)
```

Verify the current MAX Bridge requirements for:
- HTTPS URLs.
- The user action that initiates the download.
- The returned Promise.
- Download and cancellation statuses.
- Errors and limitations.
- Handling downloads that have already started.

In particular, the MAX `downloadFile()` call must happen directly inside the user click handler, without awaiting an Axios request first.

### 6.2. C# Backend Integration

The frontend and backend are hosted on separate domains. Authentication already uses HttpOnly Cookies.

Do not assume that the native MAX downloader automatically sends cookies or arbitrary HTTP headers.

Preferred approach:

1. The frontend requests download information in advance using the existing authentication mechanism.
2. The backend verifies the user and their access permissions.
3. The backend creates a short-lived signed URL or temporary download ticket.
4. The frontend stores the URL until the user clicks the download button.
5. On click, the frontend immediately calls MAX `downloadFile()`.

Example backend response:

```json
{
  "url": "https://storage.example.net/temp/abc123",
  "fileName": "document.pdf"
}
```

Address the security of temporary links:
- Sufficient token randomness.
- Binding the token to a specific file.
- Limited validity period.
- Protection against unauthorized access.
- Support for download retries, if required.

Do not put permanent credentials in URLs.

### 6.3. Fallback Downloads

When Bridge is unavailable, use:

`fetch → Blob → URL.createObjectURL() → a.download`

Account for:
- CORS.
- `credentials: include` for protected cross-origin requests, where applicable.
- Revoking the Blob URL after the browser has had time to process the download.
- Differences between the regular Axios/Blob implementation and MAX `downloadFile()`.

Do not trigger native and browser downloads at the same time.

## 7. Authentication

**Do not implement MAX authentication.**

This is a firm requirement.

Do not add:
- MAX Authentication.
- Backend validation of `initData`.
- `MaxInitDataValidator.cs`.
- Authentication by MAX user ID.
- Separate JWTs or sessions for MAX.
- MAX-specific user accounts.

Preserve the existing HttpOnly Cookie-based authentication.

However, test this authentication inside the MAX WebView.

Since the frontend and backend are on separate domains, verify:
- CORS.
- `Access-Control-Allow-Origin`.
- `Access-Control-Allow-Credentials`.
- Axios `withCredentials`.
- `SameSite`.
- `Secure`.
- Third-party cookie restrictions in MAX on Android and iOS.
- CSRF protection.

Do not change the existing authentication architecture without a demonstrated technical need.

## 8. Modal Windows

The application already uses custom Vue modal windows and a modal plugin.

**Do not replace them with MAX UI or native MAX dialogs.**

Do not rewrite the existing modal manager.

Verify that existing modals work correctly inside the MAX WebView:
- `position: fixed`.
- `z-index`.
- `overflow`.
- Nested modal windows.
- Teleport to `body`, if needed.
- Viewport height.
- Scrolling.
- On-screen keyboard behavior on iOS and Android.
- Closing and restoring state.

If MAX BackButton integration is required, use the existing modal manager.

### 8.1. MAX BackButton

Create a single mechanism for handling the native BackButton.

Use this priority:

1. If a modal is open, close the topmost modal.
2. If no modal is open but the application has a previous route, navigate back using Vue Router.
3. If the user is on the main screen, hide the MAX BackButton.

Do not register separate handlers in every component.

Subscribe to BackButton once, unsubscribe correctly, and synchronize button visibility with Router and modal-manager state.

Do not rely solely on `window.history.length`.

First inspect how the existing modal manager works, then implement the integration.

## 9. Vue Router

Preserve the existing Vue Router implementation.

Verify:
- Whether the application uses History Mode or Hash Mode.
- Correct handling of MAX launch parameters.
- Deep Link behavior.
- Handling of the `start_param` launch parameter, if needed by the application.
- BackButton integration.

If the application uses History Mode, verify that the server falls back to `index.html` for client-side routes.

Do not rewrite routing without a clear need.

## 10. CSS and Viewport

Do not change color schemes.

Verify:
- `100vh` and `100dvh`.
- Safe Area using CSS `env()`, where necessary.
- `position: fixed`.
- `position: sticky`.
- Scrollable containers.
- Fixed bottom panels.
- Modal windows.
- On-screen keyboard behavior.
- Viewport behavior on iOS and Android.

Do not add Safe Area Insets to every container indiscriminately.

Do not treat MAX Bridge as a universal source of Safe Area Insets.

Use standard browser APIs wherever they are sufficient.

## 11. Vue CLI and Build

Do not migrate the project to Vite.

Preserve Vue CLI and the existing Webpack configuration.

Verify:
- `public/index.html` does not contain a static MAX script tag.
- Conditional Bridge loading is performed exclusively through dynamic script injection.
- `publicPath`.
- Environment variables.
- Vue Router fallback.
- Production build.

The MAX bot token must never be included in the frontend bundle.

## 12. Implementation Order

Split implementation into stages:

1. Inspect the existing Vue CLI project, `main.js`, Vue Router, Axios, modal plugin, and current file-download implementation.
2. Implement MAX launch-context detection.
3. Implement conditional dynamic Bridge loading.
4. Implement MAX Adapter, Web Adapter, and MAX Fallback Adapter.
5. Implement the Platform Plugin and integrate it into the bootstrap sequence.
6. Implement MAX and fallback file downloads.
7. Integrate BackButton with the existing modal manager and Vue Router.
8. Verify viewport behavior and CSS.
9. Test the application in all target environments.

## 13. Testing Requirements

Verify the following scenarios:

| Scenario | Expected result |
|---|---|
| Regular Chrome | Bridge is not loaded at all |
| MAX Android | Bridge loads and MAX Adapter is used |
| MAX iOS | Bridge loads and MAX Adapter is used |
| MAX Desktop | Bridge loads and MAX Adapter is used |
| MAX CDN unavailable | Application starts using MAX Fallback Adapter |
| Bridge timeout | No indefinite loading |
| Script loads after timeout | Adapter is not switched automatically |
| Regular authentication | Continues to work using the existing Cookie |
| Browser download | Existing download mechanism is used |
| MAX download | MAX `downloadFile()` is used |
| Download without Bridge | Blob fallback is used |
| Modal open + BackButton | Topmost modal is closed |
| No modal + BackButton | Vue Router navigates back |
| Main page + BackButton | MAX BackButton is hidden |

Also test slow network connections, CDN unavailability, and backend API failures.

## 14. Expected Deliverables

I need an implementation, not just architectural recommendations.

Expected results:

1. A short implementation plan.
2. Complete source code for all new modules.
3. Examples of integration with `main.js`.
4. An example of BackButton integration with the modal manager and Vue Router.
5. Instructions for integrating the solution into the existing project.
6. Description of C# backend requirements for issuing temporary download links.
7. A brief description of known limitations.
8. Tests for the main environment-detection, Bridge-loading, and adapter-selection scenarios.
9. All final files packaged into a single ZIP archive.

Before implementation, inspect the supplied project. Do not assume names or APIs of the existing modal plugin, Axios services, or Router.

Do not invent MAX Bridge methods: use the current official MAX documentation and verify API signatures.

If the source project is not provided, prepare a standalone integration module and clearly identify its integration points.

Do not claim that tests or builds passed unless they were actually run.

**Core principle:** the existing Vue application must continue to work fully in a regular browser. MAX is an additional runtime environment and must not require rewriting the application.
