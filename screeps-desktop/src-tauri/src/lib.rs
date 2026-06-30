use keyring::Entry;

#[tauri::command]
fn keyring_set(service: &str, account: &str, secret: &str) -> Result<(), String> {
    Entry::new(service, account)
        .map_err(|e| e.to_string())?
        .set_password(secret)
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn keyring_get(service: &str, account: &str) -> Result<Option<String>, String> {
    match Entry::new(service, account)
        .map_err(|e| e.to_string())?
        .get_password()
    {
        Ok(secret) => Ok(Some(secret)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(e) => Err(e.to_string()),
    }
}

#[tauri::command]
fn keyring_delete(service: &str, account: &str) -> Result<(), String> {
    match Entry::new(service, account)
        .map_err(|e| e.to_string())?
        .delete_credential()
    {
        Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
        Err(e) => Err(e.to_string()),
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_http::init())
        .invoke_handler(tauri::generate_handler![keyring_set, keyring_get, keyring_delete])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
