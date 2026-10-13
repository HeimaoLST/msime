#pragma once
#include <filesystem>
#include <nlohmann/json.hpp>

namespace msime::windows {
// 在会话选项里写上官方插件包目录：Server 程序所在目录（安装后是 Program Files 下的 server）里的 plugin-packs，安装器从 server_exe 把它装到那里（installer/Prepare-PackageFiles.ps1）。不写时共享库会去内置音效包旁边找，而 Windows 的内置音效包在 DataDir 里，那是普通用户可写的目录，不能当作安装包的东西，所以目录不在（开发运行）时也照样写上：共享库读一个不存在的目录，什么都列不出来，不会退回 DataDir。选项里已经有这一项时以它为准；Server 目录不是绝对路径或文档不是对象时不动它。
inline void name_official_plugin_packs(nlohmann::json &options,
                                       const std::filesystem::path &server_directory) {
  if (!options.is_object() || options.contains("plugin_packs") ||
      !server_directory.is_absolute())
    return;
  options["plugin_packs"] = (server_directory / "plugin-packs").u8string();
}
} // namespace msime::windows
