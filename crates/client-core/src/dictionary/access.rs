//! Cooperative cross-process access to prepared dictionaries and their user journal.
//! Lock files are stable coordination objects and must not be removed.

use std::fs::File;
use std::io;
use std::path::Path;

/// A guard held for the lifetime of every Engine/session using the paths.
pub struct DictionaryAccess {
    _files: Vec<File>,
    roots: Vec<(std::path::PathBuf, crate::file_lock::PrivateDirectory)>,
}

impl DictionaryAccess {
    /// Acquire shared access without waiting. `None` means maintenance is active.
    pub fn try_session(user: &Path, dictionaries: &Path) -> io::Result<Option<Self>> {
        Self::acquire(user, dictionaries, false)
    }

    /// Acquire exclusive maintenance access without waiting. `None` means sessions/writers are active.
    pub fn try_maintenance(user: &Path, dictionaries: &Path) -> io::Result<Option<Self>> {
        Self::acquire(user, dictionaries, true)
    }

    /// Return a handle to one of the roots captured when this lease was acquired.
    /// The handle remains bound to the original directory if its path is later replaced.
    pub fn directory(&self, path: &Path) -> io::Result<crate::file_lock::PrivateDirectory> {
        let canonical = path.canonicalize()?;
        self.roots
            .iter()
            .find(|(root, _)| root == &canonical)
            .map(|(_, directory)| directory.try_clone())
            .ok_or_else(|| io::Error::new(io::ErrorKind::NotFound, "directory is not leased"))?
    }

    fn acquire(user: &Path, dictionaries: &Path, exclusive: bool) -> io::Result<Option<Self>> {
        if !user.is_absolute() || !dictionaries.is_absolute() {
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "absolute dictionary paths required",
            ));
        }
        crate::storage::reject_symlink(user)?;
        crate::storage::reject_symlink(dictionaries)?;
        let mut roots = vec![user.canonicalize()?, dictionaries.canonicalize()?];
        roots.sort();
        roots.dedup();
        let mut files = Vec::with_capacity(roots.len());
        let mut directories = Vec::with_capacity(roots.len());
        for root in roots {
            let directory = crate::file_lock::open_private_directory(&root)?;
            let file = crate::file_lock::open_private_lock_file_at(
                &directory,
                std::ffi::OsStr::new(".msime-dictionary-access.lock"),
            )?;
            let acquired = if exclusive {
                crate::file_lock::try_exclusive(&file)?
            } else {
                crate::file_lock::try_shared(&file)?
            };
            if !acquired {
                return Ok(None);
            }
            files.push(file);
            directories.push((root, directory));
        }
        Ok(Some(Self {
            _files: files,
            roots: directories,
        }))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn shared_access_excludes_maintenance_and_releases_cleanly() {
        let user = tempfile::tempdir().unwrap();
        let dictionaries = tempfile::tempdir().unwrap();
        let first = DictionaryAccess::try_session(user.path(), dictionaries.path())
            .unwrap()
            .unwrap();
        let second = DictionaryAccess::try_session(user.path(), dictionaries.path())
            .unwrap()
            .unwrap();
        assert!(
            DictionaryAccess::try_maintenance(user.path(), dictionaries.path())
                .unwrap()
                .is_none()
        );
        drop(first);
        assert!(
            DictionaryAccess::try_maintenance(user.path(), dictionaries.path())
                .unwrap()
                .is_none()
        );
        drop(second);
        // Other tests spawn processes concurrently. On Unix, fork can briefly
        // inherit our locked file descriptions before close-on-exec runs.
        let deadline = std::time::Instant::now() + std::time::Duration::from_secs(2);
        let writer = loop {
            if let Some(writer) =
                DictionaryAccess::try_maintenance(user.path(), dictionaries.path()).unwrap()
            {
                break writer;
            }
            assert!(
                std::time::Instant::now() < deadline,
                "released dictionary lock remained busy"
            );
            std::thread::sleep(std::time::Duration::from_millis(1));
        };
        assert!(
            DictionaryAccess::try_session(user.path(), dictionaries.path())
                .unwrap()
                .is_none()
        );
        drop(writer);
        assert!(
            DictionaryAccess::try_session(user.path(), dictionaries.path())
                .unwrap()
                .is_some()
        );
    }

    #[cfg(unix)]
    #[test]
    fn rejects_a_symlinked_root_before_creating_an_external_lock() {
        use std::os::unix::fs::symlink;

        let parent = tempfile::tempdir().unwrap();
        let outside = tempfile::tempdir().unwrap();
        let user = parent.path().join("user");
        symlink(outside.path(), &user).unwrap();
        let dictionaries = tempfile::tempdir().unwrap();

        assert!(DictionaryAccess::try_session(&user, dictionaries.path()).is_err());
        assert!(!outside
            .path()
            .join(".msime-dictionary-access.lock")
            .exists());
    }

    #[cfg(unix)]
    #[test]
    fn maintenance_directory_handle_survives_root_replacement() {
        use std::fs;

        let root = tempfile::tempdir().unwrap();
        let user = root.path().join("user");
        let dictionaries = root.path().join("dictionaries");
        fs::create_dir(&user).unwrap();
        fs::create_dir(&dictionaries).unwrap();
        let access = DictionaryAccess::try_maintenance(&user, &dictionaries)
            .unwrap()
            .unwrap();
        let bound = access.directory(&user).unwrap();

        let moved = root.path().join("moved-user");
        fs::rename(&user, &moved).unwrap();
        fs::create_dir(&user).unwrap();
        crate::file_lock::write_private_file_at(&bound, std::ffi::OsStr::new("marker"), b"bound")
            .unwrap();

        assert_eq!(fs::read(moved.join("marker")).unwrap(), b"bound");
        assert!(!user.join("marker").exists());
    }
}
