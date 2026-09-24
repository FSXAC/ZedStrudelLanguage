use std::{env, fs};
use zed_extension_api::{
    self as zed, serde_json, settings::LspSettings, LanguageServerId,
    LanguageServerInstallationStatus, Result,
};

const PACKAGE_NAME: &str = "strudel-language-server";
const SERVER_PATH: &str = "node_modules/strudel-language-server/dist/server.mjs";

struct StrudelExtension {
    did_find_server: bool,
}

impl StrudelExtension {
    fn server_exists(&self) -> bool {
        fs::metadata(SERVER_PATH).is_ok_and(|m| m.is_file())
    }

    /// Installs (or updates) the language server from npm into the extension's work dir.
    fn server_script_path(&mut self, id: &LanguageServerId) -> Result<String> {
        let exists = self.server_exists();
        if self.did_find_server && exists {
            return Ok(SERVER_PATH.to_string());
        }

        zed::set_language_server_installation_status(
            id,
            &LanguageServerInstallationStatus::CheckingForUpdate,
        );
        let version = zed::npm_package_latest_version(PACKAGE_NAME)?;

        if !exists || zed::npm_package_installed_version(PACKAGE_NAME)?.as_ref() != Some(&version) {
            zed::set_language_server_installation_status(
                id,
                &LanguageServerInstallationStatus::Downloading,
            );
            match zed::npm_install_package(PACKAGE_NAME, &version) {
                Ok(()) if !self.server_exists() => {
                    return Err(format!("installed {PACKAGE_NAME} but {SERVER_PATH} is missing"));
                }
                Ok(()) => {}
                // Keep using an older install if the update fails (e.g. offline).
                Err(err) if !exists => return Err(err),
                Err(_) => {}
            }
        }

        self.did_find_server = true;
        Ok(SERVER_PATH.to_string())
    }
}

impl zed::Extension for StrudelExtension {
    fn new() -> Self {
        Self { did_find_server: false }
    }

    fn language_server_command(
        &mut self,
        id: &LanguageServerId,
        worktree: &zed::Worktree,
    ) -> Result<zed::Command> {
        // Allow a custom server via settings, e.g. for local development:
        // "lsp": { "strudel-language-server": { "binary": { "path": "/path/to/dist/server.mjs" } } }
        let binary = LspSettings::for_worktree(id.as_ref(), worktree)
            .ok()
            .and_then(|s| s.binary);
        if let Some(path) = binary.as_ref().and_then(|b| b.path.clone()) {
            let mut args = binary
                .as_ref()
                .and_then(|b| b.arguments.clone())
                .unwrap_or_else(|| vec!["--stdio".into()]);
            let env = binary
                .and_then(|b| b.env)
                .map(|e| e.into_iter().collect())
                .unwrap_or_default();
            // Scripts run on Zed's bundled Node.
            if path.ends_with(".js") || path.ends_with(".mjs") {
                args.insert(0, path);
                return Ok(zed::Command { command: zed::node_binary_path()?, args, env });
            }
            return Ok(zed::Command { command: path, args, env });
        }

        let script = self.server_script_path(id)?;
        let script = env::current_dir()
            .map_err(|e| e.to_string())?
            .join(script)
            .to_string_lossy()
            .into_owned();
        Ok(zed::Command {
            command: zed::node_binary_path()?,
            args: vec![script, "--stdio".into()],
            env: Default::default(),
        })
    }

    fn language_server_initialization_options(
        &mut self,
        id: &LanguageServerId,
        worktree: &zed::Worktree,
    ) -> Result<Option<serde_json::Value>> {
        Ok(LspSettings::for_worktree(id.as_ref(), worktree)
            .ok()
            .and_then(|s| s.initialization_options.or(s.settings)))
    }

    fn language_server_workspace_configuration(
        &mut self,
        id: &LanguageServerId,
        worktree: &zed::Worktree,
    ) -> Result<Option<serde_json::Value>> {
        Ok(LspSettings::for_worktree(id.as_ref(), worktree)
            .ok()
            .and_then(|s| s.settings))
    }
}

zed::register_extension!(StrudelExtension);
