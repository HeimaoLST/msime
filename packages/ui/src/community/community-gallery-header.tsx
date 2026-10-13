import type { ReactNode } from "react";
import { CommunityGalleryHeading } from "./community-gallery-heading";
import { CommunitySearchForm } from "./community-search-form";

/** Search and heading controls in the order shared by community gallery pages. */
export function CommunityGalleryHeader({
  searchLabel,
  search,
  onSearchChange,
  onSearchSubmit,
  title,
  note,
  children,
}: {
  searchLabel: string;
  search: string;
  onSearchChange: (value: string) => void;
  onSearchSubmit: () => void;
  title: ReactNode;
  note: ReactNode;
  children?: ReactNode;
}) {
  return (
    <>
      <CommunitySearchForm
        label={searchLabel}
        value={search}
        onChange={onSearchChange}
        onSubmit={onSearchSubmit}
      />
      <CommunityGalleryHeading title={title} note={note}>
        {children}
      </CommunityGalleryHeading>
    </>
  );
}
