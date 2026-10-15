import { useToast } from "./toast";
import { errorMessage } from "./error-message";

/** 执行一个宿主异步操作，失败时用统一的错误文案显示 toast。 */
export function useHostAction() {
  const toast = useToast();
  return (action: (() => Promise<void>) | undefined) => {
    if (!action) return;
    void action().catch((error: unknown) => toast(errorMessage(error)));
  };
}
