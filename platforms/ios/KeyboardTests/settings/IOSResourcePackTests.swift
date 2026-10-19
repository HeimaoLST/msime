import XCTest

final class IOSResourcePackTests: XCTestCase {
  func testMissingPacksStillExposePinnedDownloadSizes() throws {
    let root = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
    defer { try? FileManager.default.removeItem(at: root) }
    let packs = try IOSResourcePacks.list(stateRoot: root)
    for id in ["japanese", "language-dictionaries"] {
      let pack = try XCTUnwrap(packs.first { $0.id == id })
      XCTAssertFalse(pack.installed)
      XCTAssertGreaterThan(pack.size, 0)
    }
  }

  func testUnknownPackRejectsBeforeNetworking() {
    let root = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
    defer { try? FileManager.default.removeItem(at: root) }
    XCTAssertThrowsError(try IOSResourcePacks.install("synthetic-unknown", stateRoot: root) { _, _, _ in }) { error in
      XCTAssertEqual((error as? IOSResourcePacks.Failure)?.code, "resource_pack_unknown")
    }
  }

  func testInitialProgressCanCancelBeforeAnyFileAccess() throws {
    let root = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
    defer { try? FileManager.default.removeItem(at: root) }
    var phases: [String] = []
    XCTAssertThrowsError(try IOSResourcePacks.install("japanese", stateRoot: root, files: []) { phase, done, total in
      phases.append(phase)
      XCTAssertEqual(done, 0)
      XCTAssertGreaterThan(total, 0)
      IOSResourcePacks.cancel("japanese")
    }) { error in
      XCTAssertEqual((error as? IOSResourcePacks.Failure)?.code, "local_model_cancelled")
    }
    XCTAssertEqual(phases, ["import"])
    XCTAssertFalse(FileManager.default.fileExists(atPath: root.path))
  }

  func testCancelledAttemptDoesNotEnterTheInstaller() {
    let download = IOSResourcePackDownload(id: "synthetic-unknown")
    download.cancel()
    XCTAssertThrowsError(try download.install { _, _, _ in XCTFail("取消后不应收到进度") }) { error in
      XCTAssertEqual((error as? IOSResourcePacks.Failure)?.code, "local_model_cancelled")
    }
  }

  func testUnavailableJapaneseStaysEnabledButIsNotOffered() {
    let enabled: [ChineseInputScheme] = [.quanpin, .japanese, .japaneseNineKey, .cantonese]
    XCTAssertEqual(InputSchemePreference.offeredSchemes(enabled: enabled, installed: [], japaneseAvailable: false), [.quanpin])
    XCTAssertEqual(InputSchemePreference.offeredSchemes(enabled: enabled, installed: [.cantonese], japaneseAvailable: true), enabled)
  }

  func testKeyboardAndAppUseTheSamePackNames() {
    XCTAssertEqual(IOSResourcePacks.requiredPack(for: .japaneseNineKey), "japanese")
    XCTAssertEqual(IOSResourcePacks.requiredPack(for: .zhuyin), "language-dictionaries")
    XCTAssertEqual(IOSResourcePacks.requiredPack(for: .stroke), "language-dictionaries")
    XCTAssertNil(IOSResourcePacks.requiredPack(for: .korean))
    XCTAssertNil(IOSResourcePacks.requiredPack(for: .quanpin))
  }
}
