import type {
  CommunityReportReason,
  CommunityResource,
  CommunityResourceApplication,
  CommunityResourceClient,
  CommunityResourceContent,
  CommunityResourceKind,
  CommunityResourcePage,
  CommunityResourceScope,
} from "@msime/ui";

type Invoke = <T>(command: string, args?: Record<string, unknown>) => Promise<T>;

/** 创建社区词包与回复模板的 Tauri bridge；回复键盘专属方法仅在移动宿主显式开启。 */
export function createCommunityResourceClient(
  invoke: Invoke,
  options: { includeReplyActions?: boolean } = {},
): CommunityResourceClient {
  const client: CommunityResourceClient = {
    list: (
      kind: CommunityResourceKind,
      scope: CommunityResourceScope,
      search: string,
      offset: number,
    ) => invoke<CommunityResourcePage>("community_resource_list", { kind, scope, search, offset }),
    detail: (id: string) => invoke<CommunityResource>("community_resource_detail", { id }),
    publish: (
      id: string,
      kind: CommunityResourceKind,
      name: string,
      description: string,
      content: CommunityResourceContent,
      revision: number,
    ) =>
      invoke<void>("community_resource_publish", {
        id,
        kind,
        name,
        description,
        content,
        revision,
      }),
    apply: (id: string, resourceRevision: number) =>
      invoke<CommunityResourceApplication>("community_resource_apply", { id, resourceRevision }),
    save: (id: string, saved: boolean) => invoke<void>("community_resource_save", { id, saved }),
    rate: (id: string, stars: number) => invoke<void>("community_resource_rate", { id, stars }),
    unpublish: (id: string) => invoke<void>("community_resource_unpublish", { id }),
    report: (
      kind: CommunityResourceKind,
      id: string,
      reason: CommunityReportReason,
      detail: string,
    ) =>
      invoke<void>("community_report", {
        kind: kind === "dictionary" ? "dictionaries" : "replies",
        id,
        reason,
        detail,
      }),
  };
  if (options.includeReplyActions) {
    client.storeReply = (item: CommunityResource) =>
      invoke<void>("community_resource_store_reply", { item });
    client.removeReply = (id: string) => invoke<void>("community_resource_remove_reply", { id });
  }
  return client;
}
