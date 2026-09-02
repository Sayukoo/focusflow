mod app_lock;

use app_lock::{AppLockState, RunningApp};
use discord_rich_presence::{activity, DiscordIpc, DiscordIpcClient};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use tauri::menu::{Menu, MenuItem, PredefinedMenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{AppHandle, Emitter, Manager, WindowEvent};
use tauri_plugin_opener::OpenerExt;

const DISCORD_CLIENT_ID: &str = "1348000000000000000";

pub struct WindowPinState {
    pub is_pinned: Arc<AtomicBool>,
}

impl WindowPinState {
    pub fn new() -> Self {
        Self {
            is_pinned: Arc::new(AtomicBool::new(false)),
        }
    }
}

pub struct DiscordRpcState {
    client: Mutex<Option<DiscordIpcClient>>,
}

impl DiscordRpcState {
    pub fn new() -> Self {
        Self {
            client: Mutex::new(None),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DiscordPresencePayload {
    pub details: Option<String>,
    pub state: Option<String>,
    pub start_timestamp: Option<i64>,
    pub end_timestamp: Option<i64>,
    pub large_image_key: Option<String>,
    pub large_image_text: Option<String>,
    pub small_image_key: Option<String>,
    pub small_image_text: Option<String>,
}

const MUSIC_DIR_NAME: &str = "music";
const AUDIO_EXTENSIONS: &[&str] = &["mp3", "wav", "ogg", "flac", "m4a", "aac"];

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TrackInfo {
    pub id: String,
    pub title: String,
    pub filename: String,
    pub path: String,
    pub extension: String,
}

fn app_data_dir(app: &AppHandle) -> Result<PathBuf, String> {
    app.path()
        .app_data_dir()
        .map_err(|e| format!("Failed to resolve app data dir: {e}"))
}

fn music_dir(app: &AppHandle) -> Result<PathBuf, String> {
    Ok(app_data_dir(app)?.join(MUSIC_DIR_NAME))
}

fn is_audio_file(path: &Path) -> bool {
    path.extension()
        .and_then(|ext| ext.to_str())
        .map(|ext| AUDIO_EXTENSIONS.contains(&ext.to_ascii_lowercase().as_str()))
        .unwrap_or(false)
}

fn title_from_filename(filename: &str) -> String {
    Path::new(filename)
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or(filename)
        .replace('_', " ")
        .replace('-', " ")
}

fn unique_destination(dir: &Path, original_name: &str) -> PathBuf {
    let candidate = dir.join(original_name);
    if !candidate.exists() {
        return candidate;
    }

    let stem = Path::new(original_name)
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("track");
    let ext = Path::new(original_name)
        .extension()
        .and_then(|s| s.to_str())
        .map(|s| format!(".{s}"))
        .unwrap_or_default();

    let mut index = 1;
    loop {
        let next = dir.join(format!("{stem} ({index}){ext}"));
        if !next.exists() {
            return next;
        }
        index += 1;
    }
}

fn track_from_path(path: &Path) -> Option<TrackInfo> {
    if !is_audio_file(path) {
        return None;
    }

    let filename = path.file_name()?.to_str()?.to_string();
    let extension = path
        .extension()
        .and_then(|ext| ext.to_str())
        .unwrap_or("")
        .to_ascii_lowercase();

    Some(TrackInfo {
        id: path.to_string_lossy().to_string(),
        title: title_from_filename(&filename),
        filename,
        path: path.to_string_lossy().to_string(),
        extension,
    })
}

#[tauri::command]
fn ensure_music_dir(app: AppHandle) -> Result<String, String> {
    let dir = music_dir(&app)?;
    fs::create_dir_all(&dir).map_err(|e| format!("Failed to create music dir: {e}"))?;
    Ok(dir.to_string_lossy().to_string())
}

#[tauri::command]
fn get_music_dir(app: AppHandle) -> Result<String, String> {
    ensure_music_dir(app)
}

#[tauri::command]
fn list_tracks(app: AppHandle) -> Result<Vec<TrackInfo>, String> {
    let dir = music_dir(&app)?;
    fs::create_dir_all(&dir).map_err(|e| format!("Failed to create music dir: {e}"))?;

    let mut tracks = Vec::new();
    let entries = fs::read_dir(&dir).map_err(|e| format!("Failed to read music dir: {e}"))?;

    for entry in entries {
        let entry = entry.map_err(|e| format!("Failed to read entry: {e}"))?;
        let path = entry.path();
        if path.is_file() {
            if let Some(track) = track_from_path(&path) {
                tracks.push(track);
            }
        }
    }

    tracks.sort_by(|a, b| a.title.to_lowercase().cmp(&b.title.to_lowercase()));
    Ok(tracks)
}

#[tauri::command]
fn import_tracks(app: AppHandle, paths: Vec<String>) -> Result<Vec<TrackInfo>, String> {
    let dir = music_dir(&app)?;
    fs::create_dir_all(&dir).map_err(|e| format!("Failed to create music dir: {e}"))?;

    let mut imported = Vec::new();

    for source in paths {
        let source_path = PathBuf::from(&source);
        if !source_path.is_file() || !is_audio_file(&source_path) {
            continue;
        }

        let original_name = source_path
            .file_name()
            .and_then(|n| n.to_str())
            .ok_or_else(|| format!("Invalid filename: {source}"))?;

        let destination = unique_destination(&dir, original_name);
        fs::copy(&source_path, &destination)
            .map_err(|e| format!("Failed to copy {source}: {e}"))?;

        if let Some(track) = track_from_path(&destination) {
            imported.push(track);
        }
    }

    Ok(imported)
}

#[tauri::command]
fn delete_track(app: AppHandle, path: String) -> Result<(), String> {
    let music = music_dir(&app)?;
    let target = PathBuf::from(&path);

    let canonical_music = fs::canonicalize(&music)
        .map_err(|e| format!("Failed to resolve music dir: {e}"))?;
    let canonical_target = fs::canonicalize(&target)
        .map_err(|e| format!("Failed to resolve track path: {e}"))?;

    if !canonical_target.starts_with(&canonical_music) {
        return Err("Refusing to delete a file outside the music library".into());
    }

    fs::remove_file(&canonical_target).map_err(|e| format!("Failed to delete track: {e}"))?;
    Ok(())
}

#[tauri::command]
fn open_music_dir(app: AppHandle) -> Result<(), String> {
    let dir = ensure_music_dir(app.clone())?;
    app.opener()
        .open_path(dir, None::<&str>)
        .map_err(|e| format!("Failed to open music folder: {e}"))?;
    Ok(())
}

#[tauri::command]
fn update_discord_presence(
    state: tauri::State<'_, DiscordRpcState>,
    payload: DiscordPresencePayload,
) -> Result<(), String> {
    let mut guard = state.client.lock().map_err(|e| e.to_string())?;

    if guard.is_none() {
        if let Ok(mut client) = DiscordIpcClient::new(DISCORD_CLIENT_ID) {
            if client.connect().is_ok() {
                *guard = Some(client);
            }
        }
    }

    if let Some(client) = guard.as_mut() {
        let mut activity_builder = activity::Activity::new();

        if let Some(ref details) = payload.details {
            if !details.is_empty() {
                activity_builder = activity_builder.details(details);
            }
        }

        if let Some(ref st) = payload.state {
            if !st.is_empty() {
                activity_builder = activity_builder.state(st);
            }
        }

        let mut timestamps_builder = activity::Timestamps::new();
        let mut has_timestamps = false;
        if let Some(start) = payload.start_timestamp {
            timestamps_builder = timestamps_builder.start(start);
            has_timestamps = true;
        }
        if let Some(end) = payload.end_timestamp {
            timestamps_builder = timestamps_builder.end(end);
            has_timestamps = true;
        }
        if has_timestamps {
            activity_builder = activity_builder.timestamps(timestamps_builder);
        }

        let mut assets_builder = activity::Assets::new();
        let mut has_assets = false;
        let large_key = payload.large_image_key.as_deref().unwrap_or("app_icon");
        assets_builder = assets_builder.large_image(large_key);
        has_assets = true;

        if let Some(ref large_txt) = payload.large_image_text {
            assets_builder = assets_builder.large_text(large_txt);
        }

        if let Some(ref small_key) = payload.small_image_key {
            assets_builder = assets_builder.small_image(small_key);
        }
        if let Some(ref small_txt) = payload.small_image_text {
            assets_builder = assets_builder.small_text(small_txt);
        }

        if has_assets {
            activity_builder = activity_builder.assets(assets_builder);
        }

        if client.set_activity(activity_builder).is_err() {
            *guard = None;
        }
    }

    Ok(())
}

#[tauri::command]
fn clear_discord_presence(state: tauri::State<'_, DiscordRpcState>) -> Result<(), String> {
    let mut guard = state.client.lock().map_err(|e| e.to_string())?;
    if let Some(client) = guard.as_mut() {
        let _ = client.clear_activity();
    }
    Ok(())
}

#[tauri::command]
fn list_running_apps() -> Result<Vec<RunningApp>, String> {
    app_lock::list_running_apps()
}

#[tauri::command]
fn start_app_lock(
    app: AppHandle,
    state: tauri::State<'_, AppLockState>,
    allowed: Vec<String>,
) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    let own_hwnd: Option<isize> = app
        .webview_windows()
        .values()
        .next()
        .and_then(|window| window.hwnd().ok())
        .map(|hwnd| hwnd.0 as isize);
    #[cfg(not(target_os = "windows"))]
    let own_hwnd: Option<isize> = {
        let _ = &app;
        None
    };

    app_lock::start(&state, allowed, own_hwnd)
}

#[tauri::command]
fn stop_app_lock(state: tauri::State<'_, AppLockState>) -> Result<(), String> {
    app_lock::stop(&state);
    Ok(())
}

#[cfg(target_os = "windows")]
fn enforce_topmost(window: &tauri::WebviewWindow, topmost: bool) {
    use windows::Win32::Foundation::HWND;
    use windows::Win32::UI::WindowsAndMessaging::{
        SetWindowPos, HWND_NOTOPMOST, HWND_TOPMOST, SWP_NOACTIVATE, SWP_NOMOVE, SWP_NOSIZE,
        SWP_SHOWWINDOW,
    };

    if let Ok(hwnd) = window.hwnd() {
        unsafe {
            let insert_after = if topmost {
                HWND_TOPMOST
            } else {
                HWND_NOTOPMOST
            };
            let _ = SetWindowPos(
                HWND(hwnd.0 as *mut _),
                Some(insert_after),
                0,
                0,
                0,
                0,
                SWP_NOMOVE | SWP_NOSIZE | SWP_NOACTIVATE | SWP_SHOWWINDOW,
            );
        }
    }
}

#[cfg(not(target_os = "windows"))]
fn enforce_topmost(_window: &tauri::WebviewWindow, _topmost: bool) {}

#[tauri::command]
fn set_window_pinned(
    app: AppHandle,
    state: tauri::State<'_, WindowPinState>,
    pinned: bool,
) -> Result<(), String> {
    state.is_pinned.store(pinned, Ordering::SeqCst);
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.set_always_on_top(pinned);
        enforce_topmost(&window, pinned);
    }
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let pin_state = WindowPinState::new();
    let is_pinned_flag = pin_state.is_pinned.clone();

    let builder = tauri::Builder::default()
        .manage(DiscordRpcState::new())
        .manage(AppLockState::new())
        .manage(pin_state)
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init());

    #[cfg(desktop)]
    let builder = builder.plugin(
        tauri_plugin_autostart::Builder::new()
            .app_name("FocusFlow")
            .build(),
    );

    builder
        .invoke_handler(tauri::generate_handler![
            ensure_music_dir,
            get_music_dir,
            list_tracks,
            import_tracks,
            delete_track,
            open_music_dir,
            update_discord_presence,
            clear_discord_presence,
            list_running_apps,
            start_app_lock,
            stop_app_lock,
            set_window_pinned
        ])
        .setup(move |app| {
            let _ = ensure_music_dir(app.handle().clone());

            let quick_pomodoro_item = MenuItem::with_id(
                app,
                "quick_pomodoro",
                "Pomodoro 25/5 + focus music",
                true,
                None::<&str>,
            )?;
            let show_item =
                MenuItem::with_id(app, "show", "Show FocusFlow", true, None::<&str>)?;
            let quit_item = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
            let separator = PredefinedMenuItem::separator(app)?;
            let tray_menu = Menu::with_items(
                app,
                &[&quick_pomodoro_item, &separator, &show_item, &separator, &quit_item],
            )?;

            let mut tray_builder = TrayIconBuilder::new()
                .menu(&tray_menu)
                .show_menu_on_left_click(false)
                .tooltip("FocusFlow")
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "quick_pomodoro" => {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.unminimize();
                            let _ = window.set_focus();
                        }
                        let _ = app.emit("tray-quick-pomodoro", ());
                    }
                    "show" => {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.unminimize();
                            let _ = window.set_focus();
                        }
                    }
                    "quit" => {
                        app.exit(0);
                    }
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        let app = tray.app_handle();
                        if let Some(window) = app.get_webview_window("main") {
                            let visible = window.is_visible().unwrap_or(false);
                            if visible {
                                let _ = window.hide();
                            } else {
                                let _ = window.show();
                                let _ = window.unminimize();
                                let _ = window.set_focus();
                            }
                        }
                    }
                });
            if let Some(icon) = app.default_window_icon() {
                tray_builder = tray_builder.icon(icon.clone());
            }
            tray_builder.build(app)?;

            if let Some(window) = app.get_webview_window("main") {
                let _ = window.set_skip_taskbar(true);
                let window_for_events = window.clone();
                let is_pinned_for_events = is_pinned_flag.clone();
                window.on_window_event(move |event| match event {
                    WindowEvent::Resized(_) => {
                        if window_for_events.is_minimized().unwrap_or(false) {
                            let _ = window_for_events.hide();
                        } else if is_pinned_for_events.load(Ordering::SeqCst) {
                            let _ = window_for_events.set_always_on_top(true);
                            enforce_topmost(&window_for_events, true);
                        }
                    }
                    WindowEvent::Moved(_) => {
                        if is_pinned_for_events.load(Ordering::SeqCst) {
                            let _ = window_for_events.set_always_on_top(true);
                            enforce_topmost(&window_for_events, true);
                        }
                    }
                    WindowEvent::Focused(false) => {
                        if is_pinned_for_events.load(Ordering::SeqCst) {
                            let _ = window_for_events.set_always_on_top(true);
                            enforce_topmost(&window_for_events, true);
                        }
                    }
                    WindowEvent::CloseRequested { api, .. } => {
                        let _ = window_for_events.hide();
                        api.prevent_close();
                    }
                    _ => {}
                });
            }

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

