type Invoke = <T>(command: string, args?: Record<string, unknown>) => Promise<T>;
type Listen = <T>(event: string, handler: (event: { payload: T }) => void) => Promise<() => void>;

type TauriProgressCommands = {
  list: string;
  install: string;
  cancel: string;
  progress: string;
};

/** 创建带列表、安装、取消和进度事件的 Tauri 资源客户端；页面仍负责订阅生命周期。 */
export function createTauriProgressClient<TList, TProgress>(
  invoke: Invoke,
  listen: Listen,
  commands: TauriProgressCommands,
) {
  return {
    list: () => invoke<TList>(commands.list),
    install: (id: string) => invoke<string>(commands.install, { id }),
    cancel: (id: string) => invoke<boolean>(commands.cancel, { id }),
    onProgress: (listener: (progress: TProgress) => void) =>
      listen<TProgress>(commands.progress, (event) => listener(event.payload)),
  };
}
