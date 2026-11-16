declare module 'vue' {
  export function createApp(rootComponent: unknown): {
    config: { globalProperties: Record<string, unknown> }
    use(plugin: unknown, options?: unknown): unknown
    mount(selector: string): unknown
  }
}

declare module '*.vue' {
  const component: unknown
  export default component
}
