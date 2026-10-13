import { expect, test, vi } from "vitest";
import { useSettingsDestinationActions } from "@msime/ui";

test("creates shared about and community destinations", () => {
  const selectPage = vi.fn();
  const setShowTouchSkinEditor = vi.fn();
  const setCommunityDestination = vi.fn();
  const actions = useSettingsDestinationActions({
    selectPage,
    setShowTouchSkinEditor,
    setCommunityDestination,
  });

  actions.openAbout();
  actions.openCommunityAll();

  expect(selectPage).toHaveBeenNthCalledWith(1, "about");
  expect(selectPage).toHaveBeenNthCalledWith(2, "community");
  expect(setCommunityDestination).toHaveBeenCalledWith("all");
});

test("opens local designs and keeps the editor open", () => {
  const selectPage = vi.fn();
  const setShowTouchSkinEditor = vi.fn();
  const actions = useSettingsDestinationActions({
    selectPage,
    setShowTouchSkinEditor,
    setCommunityDestination: vi.fn(),
  });

  actions.openLocalDesigns();

  expect(selectPage).toHaveBeenCalledWith("skin");
  expect(setShowTouchSkinEditor).toHaveBeenCalledWith(true);
});

test("touch hosts open community destinations as a gallery on the feature page", () => {
  const selectPage = vi.fn();
  const setCommunityDestination = vi.fn();
  const openCommunityGallery = vi.fn();
  const actions = useSettingsDestinationActions({
    selectPage,
    setShowTouchSkinEditor: vi.fn(),
    setCommunityDestination,
    openCommunityGallery,
  });

  actions.openCommunity("saved-reply");
  actions.openCommunityAll();

  expect(openCommunityGallery).toHaveBeenNthCalledWith(1, {
    category: "reply",
    scope: "saved",
    initialMine: false,
  });
  expect(openCommunityGallery).toHaveBeenNthCalledWith(2, {
    category: "skin",
    scope: "",
    initialMine: false,
  });
  expect(selectPage).not.toHaveBeenCalled();
  expect(setCommunityDestination).not.toHaveBeenCalled();
});
