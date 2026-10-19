import { useEffect, useState } from "react";
import { useMountedRef } from "./use-mounted-ref";
import { useAsyncGeneration } from "./use-async-generation";

const releaseDateShape = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

/** 宿主报告的发布日期：形如 `YYYY-MM-DD` 的原样返回，空值和其他任何形状都当作不知道，返回空字符串。 */
export function parseReleaseDate(value: unknown): string {
  if (typeof value !== "string") return "";
  const date = value.trim();
  return releaseDateShape.test(date) ? date : "";
}

/** 关于页的版本写法：有发布日期时是 `v0.53.0（2026-10-19 发布）`，没有时只是 `v0.53.0`。 */
export function formatAppVersion(version: string, releaseDate: string): string {
  return releaseDate ? `v${version}（${releaseDate} 发布）` : `v${version}`;
}

/** 读取宿主报告的发布日期；宿主不提供、读取失败或形状不对时为空字符串。 */
export function useAppReleaseDate(readAppReleaseDate?: () => Promise<string>): string {
  const [releaseDate, setReleaseDate] = useState("");
  const mounted = useMountedRef();
  const generation = useAsyncGeneration(readAppReleaseDate);

  useEffect(() => {
    const current = generation.current;
    setReleaseDate("");
    if (readAppReleaseDate) {
      void readAppReleaseDate()
        .then((value) => {
          if (mounted.current && generation.current === current)
            setReleaseDate(parseReleaseDate(value));
        })
        .catch(() => undefined);
    }
  }, [readAppReleaseDate, mounted]);

  return releaseDate;
}
