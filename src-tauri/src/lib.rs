use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use tauri::{AppHandle, Manager};
use tauri_plugin_opener::OpenerExt;

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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = tauri::Builder::default()
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
            open_music_dir
        ])
        .setup(|app| {
            let _ = ensure_music_dir(app.handle().clone());
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
