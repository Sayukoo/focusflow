use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::Duration;

const POLL_INTERVAL: Duration = Duration::from_millis(400);

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RunningApp {
    pub process_name: String,
    pub window_title: String,
}

pub struct AppLockState {
    stop_flag: Mutex<Option<Arc<AtomicBool>>>,
}

impl AppLockState {
    pub fn new() -> Self {
        Self {
            stop_flag: Mutex::new(None),
        }
    }
}

#[cfg(target_os = "windows")]
mod platform {
    use super::RunningApp;
    use std::collections::HashSet;
    use windows::core::{BOOL, PWSTR};
    use windows::Win32::Foundation::{CloseHandle, HWND, LPARAM};
    use windows::Win32::System::Threading::{
        OpenProcess, QueryFullProcessImageNameW, PROCESS_NAME_WIN32,
        PROCESS_QUERY_LIMITED_INFORMATION,
    };
    use windows::Win32::UI::WindowsAndMessaging::{
        EnumWindows, GetForegroundWindow, GetWindowTextLengthW, GetWindowTextW,
        GetWindowThreadProcessId, IsWindowVisible, SetForegroundWindow, ShowWindow, SW_MINIMIZE,
        SW_RESTORE,
    };

    fn process_name_for_pid(pid: u32) -> Option<String> {
        unsafe {
            let handle = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, false, pid).ok()?;
            let mut buffer = [0u16; 512];
            let mut len = buffer.len() as u32;
            let result = QueryFullProcessImageNameW(
                handle,
                PROCESS_NAME_WIN32,
                PWSTR(buffer.as_mut_ptr()),
                &mut len,
            );
            let _ = CloseHandle(handle);
            result.ok()?;
            let path = String::from_utf16_lossy(&buffer[..len as usize]);
            path.rsplit(['\\', '/']).next().map(|s| s.to_string())
        }
    }

    fn window_title(hwnd: HWND) -> String {
        unsafe {
            let len = GetWindowTextLengthW(hwnd);
            if len <= 0 {
                return String::new();
            }
            let mut buffer = vec![0u16; (len + 1) as usize];
            let copied = GetWindowTextW(hwnd, &mut buffer);
            String::from_utf16_lossy(&buffer[..copied.max(0) as usize])
        }
    }

    unsafe extern "system" fn enum_windows_proc(hwnd: HWND, lparam: LPARAM) -> BOOL {
        let apps = &mut *(lparam.0 as *mut Vec<RunningApp>);
        if !IsWindowVisible(hwnd).as_bool() {
            return BOOL(1);
        }
        let title = window_title(hwnd);
        if title.trim().is_empty() {
            return BOOL(1);
        }
        let mut pid: u32 = 0;
        GetWindowThreadProcessId(hwnd, Some(&mut pid));
        if pid == 0 {
            return BOOL(1);
        }
        let Some(process_name) = process_name_for_pid(pid) else {
            return BOOL(1);
        };
        if !apps
            .iter()
            .any(|a| a.process_name.eq_ignore_ascii_case(&process_name))
        {
            apps.push(RunningApp {
                process_name,
                window_title: title,
            });
        }
        BOOL(1)
    }

    pub fn list_running_apps() -> Vec<RunningApp> {
        let mut apps: Vec<RunningApp> = Vec::new();
        unsafe {
            let _ = EnumWindows(
                Some(enum_windows_proc),
                LPARAM(&mut apps as *mut Vec<RunningApp> as isize),
            );
        }
        apps.sort_by(|a, b| {
            a.process_name
                .to_lowercase()
                .cmp(&b.process_name.to_lowercase())
        });
        apps
    }

    pub fn current_process_name() -> Option<String> {
        process_name_for_pid(std::process::id())
    }

    /// Checks the foreground window; if it does not belong to an allowed
    /// process, minimizes it and hands focus back to FocusFlow so the block
    /// feels deliberate instead of a random flicker into the taskbar.
    pub fn enforce_once(allowed: &HashSet<String>, own_hwnd: Option<isize>) {
        unsafe {
            let hwnd = GetForegroundWindow();
            if hwnd.0.is_null() {
                return;
            }
            let mut pid: u32 = 0;
            GetWindowThreadProcessId(hwnd, Some(&mut pid));
            if pid == 0 {
                return;
            }
            let Some(process_name) = process_name_for_pid(pid) else {
                return;
            };
            if allowed.contains(&process_name.to_lowercase()) {
                return;
            }
            let _ = ShowWindow(hwnd, SW_MINIMIZE);

            if let Some(raw) = own_hwnd {
                let focus_target = HWND(raw as *mut _);
                let _ = ShowWindow(focus_target, SW_RESTORE);
                let _ = SetForegroundWindow(focus_target);
            }
        }
    }
}

#[cfg(target_os = "windows")]
pub fn list_running_apps() -> Result<Vec<RunningApp>, String> {
    Ok(platform::list_running_apps())
}

#[cfg(not(target_os = "windows"))]
pub fn list_running_apps() -> Result<Vec<RunningApp>, String> {
    Err("App lock is only supported on Windows.".into())
}

#[cfg(target_os = "windows")]
pub fn start(
    state: &AppLockState,
    allowed: Vec<String>,
    own_hwnd: Option<isize>,
) -> Result<(), String> {
    stop(state);

    let mut own_process = platform::current_process_name()
        .unwrap_or_default()
        .to_lowercase();
    if own_process.is_empty() {
        own_process = "focusflow.exe".into();
    }

    let mut allowed_set: HashSet<String> = allowed
        .into_iter()
        .map(|name| name.trim().to_lowercase())
        .filter(|name| !name.is_empty())
        .collect();
    allowed_set.insert(own_process);

    let stop_flag = Arc::new(AtomicBool::new(false));
    *state.stop_flag.lock().map_err(|e| e.to_string())? = Some(stop_flag.clone());

    thread::spawn(move || {
        while !stop_flag.load(Ordering::Relaxed) {
            platform::enforce_once(&allowed_set, own_hwnd);
            thread::sleep(POLL_INTERVAL);
        }
    });

    Ok(())
}

#[cfg(not(target_os = "windows"))]
pub fn start(
    _state: &AppLockState,
    _allowed: Vec<String>,
    _own_hwnd: Option<isize>,
) -> Result<(), String> {
    Err("App lock is only supported on Windows.".into())
}

pub fn stop(state: &AppLockState) {
    if let Ok(mut guard) = state.stop_flag.lock() {
        if let Some(flag) = guard.take() {
            flag.store(true, Ordering::Relaxed);
        }
    }
}
