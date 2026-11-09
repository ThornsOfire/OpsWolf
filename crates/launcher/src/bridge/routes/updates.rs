use std::sync::atomic::Ordering;

use cdp_client::BridgeError;

use semver::Version;

use serde_json::Value;

use super::{
    NativeBridge, UPDATE_INSTALLER_ACTIVE, UpdateInstallParams, operation_error,
    require_empty_object, update_busy_error, update_internal_error,
};

impl NativeBridge {
    pub(super) async fn update_startup(
        &self,
        params: Value,
        epoch: u64,
    ) -> Result<Value, BridgeError> {
        require_empty_object(&params)?;
        self.ensure_epoch(epoch)?;
        let result = self
            .inner
            .update_checker
            .check_startup(env!("CARGO_PKG_VERSION"))
            .await?;
        // This launch-wide metadata has no workspace capability. A project switch
        // while GitHub responds must not turn a valid startup check into CANCELLED.
        serde_json::to_value(result).map_err(|_| update_internal_error())
    }
}

impl NativeBridge {
    pub(super) async fn update_check(
        &self,
        params: Value,
        epoch: u64,
    ) -> Result<Value, BridgeError> {
        require_empty_object(&params)?;
        self.ensure_epoch(epoch)?;
        let result = self
            .inner
            .update_checker
            .check(env!("CARGO_PKG_VERSION"))
            .await?;
        self.ensure_epoch(epoch)?;
        serde_json::to_value(result).map_err(|_| update_internal_error())
    }
}

impl NativeBridge {
    pub(super) async fn update_install(
        &self,
        params: Value,
        epoch: u64,
    ) -> Result<Value, BridgeError> {
        #[cfg(windows)]
        if UPDATE_INSTALLER_ACTIVE.load(Ordering::Acquire) {
            return Err(update_busy_error());
        }
        self.ensure_epoch(epoch)?;
        let params: UpdateInstallParams = serde_json::from_value(params).map_err(|error| {
            operation_error(
                BridgeError::invalid_request(),
                "update_install",
                format!(
                    "category={:?}; line={}; column={}; rejected payload omitted",
                    error.classify(),
                    error.line(),
                    error.column()
                ),
            )
        })?;
        let requested = Version::parse(&params.latest_version).map_err(|error| {
            operation_error(
                BridgeError::invalid_request(),
                "update_install",
                format!("versionParseError={error}; rejected version value omitted"),
            )
        })?;
        if requested.to_string() != params.latest_version
            || !requested.pre.is_empty()
            || !requested.build.is_empty()
        {
            return Err(BridgeError::invalid_request());
        }
        // Upstream setup enters installation immediately and can replace this
        // fork. Availability/renderer clicks are not reviewed OpsWolf activation.
        // Reject at the native mutation boundary, before networking or launch,
        // including callers that bypass or predate the current renderer UI.
        Err(BridgeError::new(
            "UPDATE_INSTALL_BLOCKED",
            "Upstream Code-Codex setup is blocked in OpsWolf: it can replace the fork. Review the exact update and use a separately authorized, verified deployment with rollback; no installer was downloaded or launched.",
        ))
    }
}
