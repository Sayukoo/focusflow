fn main() {
    // Keep the native Windows resource tied to the generated ICO instead of
    // relying on whichever icon path happens to be selected from the bundle
    // list. Cargo will rerun this build script whenever the ICO changes.
    println!("cargo:rerun-if-changed=icons/icon.ico");

    tauri_build::try_build(
        tauri_build::Attributes::new().windows_attributes(
            tauri_build::WindowsAttributes::new().window_icon_path("icons/icon.ico"),
        ),
    )
    .expect("failed to configure Tauri build resources");
}
