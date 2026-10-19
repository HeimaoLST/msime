//! 评测前核对资源锁，避免缺失或旧资源被误记为当前产品代次。

use msime_client_core::resources::{ResourceSet, ResourceStore};
use std::path::Path;

pub fn verify(
    resources: &Path,
    requested_lock: Option<&Path>,
) -> Result<ResourceSet, Box<dyn std::error::Error>> {
    // 默认锁随二进制固定，移动工作树或稍后更新源码都不会改变被测资源身份。
    let supplied = requested_lock.map(std::fs::read).transpose()?;
    let bytes = supplied.as_deref().unwrap_or(include_bytes!(
        "../../../../resources/desktop-dictionary.lock.json"
    ));
    let specification: ResourceSet = serde_json::from_slice(bytes)?;
    ResourceStore::new(resources)
        .verify(resources, &specification)
        .map_err(|error| format!("unverified evaluation resources: {error}"))?;
    eprintln!(
        "verified evaluation resources: source_commit={} generation={}",
        specification.source_commit,
        specification.generation()?
    );
    Ok(specification)
}

#[cfg(test)]
mod tests {
    use super::*;
    use msime_client_core::resources::Artifact;
    use std::collections::BTreeMap;
    use std::path::PathBuf;

    fn fixture() -> (tempfile::TempDir, PathBuf, PathBuf, ResourceSet) {
        let root = tempfile::tempdir().unwrap();
        let resources = root.path().join("resources");
        std::fs::create_dir(&resources).unwrap();
        let specification = ResourceSet {
            source_commit: "0123456789012345678901234567890123456789".into(),
            artifacts: ["msime-pinyin.db", "msime-bigram.bin"]
                .into_iter()
                .map(|name| Artifact {
                    name: name.into(),
                    url: format!("https://example.invalid/{name}"),
                    sha256: "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"
                        .into(),
                    size: 3,
                })
                .collect(),
        };
        for artifact in &specification.artifacts {
            std::fs::write(resources.join(&artifact.name), b"abc").unwrap();
        }
        let lock = root.path().join("resources.lock.json");
        std::fs::write(&lock, serde_json::to_vec(&specification).unwrap()).unwrap();
        (root, resources, lock, specification)
    }

    fn snapshot(resources: &Path) -> BTreeMap<std::ffi::OsString, Vec<u8>> {
        std::fs::read_dir(resources)
            .unwrap()
            .map(|entry| {
                let entry = entry.unwrap();
                (entry.file_name(), std::fs::read(entry.path()).unwrap())
            })
            .collect()
    }

    #[test]
    fn matching_custom_lock_is_verified_without_writing_resources() {
        let (_root, resources, lock, expected) = fixture();
        let before = snapshot(&resources);
        let actual = verify(&resources, Some(&lock)).unwrap();
        assert_eq!(actual.source_commit, expected.source_commit);
        assert_eq!(actual.generation().unwrap(), expected.generation().unwrap());
        assert_eq!(snapshot(&resources), before);
    }

    #[test]
    fn missing_required_ngram_is_rejected_without_repairing_it() {
        let (_root, resources, lock, _) = fixture();
        std::fs::remove_file(resources.join("msime-bigram.bin")).unwrap();
        let before = snapshot(&resources);
        let error = verify(&resources, Some(&lock)).unwrap_err().to_string();
        assert!(error.contains("unverified evaluation resources"));
        assert!(error.contains("msime-bigram.bin"));
        assert_eq!(snapshot(&resources), before);
    }

    #[test]
    fn equal_length_wrong_digest_and_wrong_length_are_rejected() {
        for bytes in [b"abd".as_slice(), b"ab".as_slice(), b"abcd".as_slice()] {
            let (_root, resources, lock, _) = fixture();
            std::fs::write(resources.join("msime-pinyin.db"), bytes).unwrap();
            let before = snapshot(&resources);
            let error = verify(&resources, Some(&lock)).unwrap_err().to_string();
            assert!(error.contains("resource length or digest mismatch"));
            assert_eq!(snapshot(&resources), before);
        }
    }

    #[test]
    fn undeclared_file_is_rejected() {
        let (_root, resources, lock, _) = fixture();
        std::fs::write(resources.join("sentence-model.safetensors"), b"abc").unwrap();
        let error = verify(&resources, Some(&lock)).unwrap_err().to_string();
        assert!(error.contains("not in the pinned resource set"));
    }

    #[test]
    fn malformed_lock_is_rejected() {
        let (_root, resources, lock, mut specification) = fixture();
        specification.source_commit = "invalid".into();
        std::fs::write(&lock, serde_json::to_vec(&specification).unwrap()).unwrap();
        assert!(verify(&resources, Some(&lock)).is_err());
        std::fs::write(&lock, b"{").unwrap();
        assert!(verify(&resources, Some(&lock)).is_err());
    }

    #[test]
    fn missing_directory_and_missing_lock_are_rejected() {
        let (root, resources, lock, _) = fixture();
        assert!(verify(&root.path().join("missing"), Some(&lock)).is_err());
        assert!(verify(&resources, Some(&root.path().join("missing.lock"))).is_err());
    }

    #[test]
    fn default_lock_rejects_a_subset_from_another_generation() {
        let (_root, resources, _lock, _) = fixture();
        let error = verify(&resources, None).unwrap_err().to_string();
        assert!(error.contains("unverified evaluation resources"));
    }
}
