#include "PluginPackRoot.h"

#include <filesystem>
#include <iostream>
#include <stdexcept>

namespace {
void require(bool value, const char *message) {
  if (!value)
    throw std::runtime_error(message);
}
} // namespace

int main() {
  namespace fs = std::filesystem;
  try {
    using msime::windows::name_official_plugin_packs;
    const auto server = fs::temp_directory_path() / "msime-plugin-pack-root" / "server";
    const nlohmann::json base = {{"api_version", 1},
                                 {"resources", (server / "resources").u8string()},
                                 {"sound_packs", (server.parent_path() / "data" / "sound-packs").u8string()}};
    // The installer's layout is plugin-packs beside the Server executable, under Program Files. The directory is never created here: a development run without it is named all the same, so the library never falls back to the user-writable DataDir beside the sound packs.
    auto options = base;
    name_official_plugin_packs(options, server);
    require(options.at("plugin_packs") == (server / "plugin-packs").u8string(),
            "The Server's plugin-packs was not named");

    // A name already in the options wins; a relative directory and a document that is not an object are left alone.
    auto named = base;
    named["plugin_packs"] = "C:\\elsewhere";
    name_official_plugin_packs(named, server);
    require(named.at("plugin_packs") == "C:\\elsewhere", "An explicit name was replaced");
    auto relative = base;
    name_official_plugin_packs(relative, fs::path("server"));
    require(!relative.contains("plugin_packs"), "A relative directory was named");
    nlohmann::json not_object = nlohmann::json::array();
    name_official_plugin_packs(not_object, server);
    require(not_object.is_array() && not_object.empty(), "A non-object document changed");
  } catch (const std::exception &error) {
    std::cerr << error.what() << '\n';
    return 1;
  }
  std::cout << "Windows official plugin pack root checks passed\n";
  return 0;
}
