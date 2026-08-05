import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import {
  copyFileSync,
  existsSync,
  mkdtempSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { delimiter, join, relative, resolve } from "node:path";
import { homedir } from "node:os";

const root = resolve(import.meta.dirname, "..");
const tauriRoot = join(root, "src-tauri");
const iconRoot = join(tauriRoot, "icons");
const iconSource = join(iconRoot, "focusflow.svg");
const releaseRoot = join(root, "release");
const androidProject = join(tauriRoot, "gen", "android");
const tauriCli = join(
  root,
  "node_modules",
  "@tauri-apps",
  "cli",
  "tauri.js",
);
const androidTarget = "aarch64";
const androidRustTarget = "aarch64-linux-android";
const buildEnv = { ...process.env };
const appVersion = readAppVersion();

const desktopIconFiles = [
  "32x32.png",
  "64x64.png",
  "128x128.png",
  "128x128@2x.png",
  "icon.png",
  "icon.ico",
  "icon.icns",
];
const windowsIconSizes = [16, 24, 32, 48, 64, 256];
const desktopPngDimensions = {
  "32x32.png": [32, 32],
  "64x64.png": [64, 64],
  "128x128.png": [128, 128],
  "128x128@2x.png": [256, 256],
  "icon.png": [512, 512],
};
const windowsStoreIconFiles = [
  "StoreLogo.png",
  "Square30x30Logo.png",
  "Square44x44Logo.png",
  "Square71x71Logo.png",
  "Square89x89Logo.png",
  "Square107x107Logo.png",
  "Square142x142Logo.png",
  "Square150x150Logo.png",
  "Square284x284Logo.png",
  "Square310x310Logo.png",
];
const androidDensities = ["mdpi", "hdpi", "xhdpi", "xxhdpi", "xxxhdpi"];
const androidIconFiles = [
  "android/mipmap-anydpi-v26/ic_launcher.xml",
  "android/values/ic_launcher_background.xml",
  ...androidDensities.flatMap((density) => [
    `android/mipmap-${density}/ic_launcher.png`,
    `android/mipmap-${density}/ic_launcher_foreground.png`,
    `android/mipmap-${density}/ic_launcher_round.png`,
  ]),
];
const iosIconFiles = [
  "ios/AppIcon-20x20@2x-1.png",
  "ios/AppIcon-20x20@1x.png",
  "ios/AppIcon-20x20@2x.png",
  "ios/AppIcon-20x20@3x.png",
  "ios/AppIcon-29x29@2x-1.png",
  "ios/AppIcon-29x29@1x.png",
  "ios/AppIcon-29x29@2x.png",
  "ios/AppIcon-29x29@3x.png",
  "ios/AppIcon-40x40@2x-1.png",
  "ios/AppIcon-40x40@1x.png",
  "ios/AppIcon-40x40@2x.png",
  "ios/AppIcon-40x40@3x.png",
  "ios/AppIcon-60x60@2x.png",
  "ios/AppIcon-60x60@3x.png",
  "ios/AppIcon-76x76@1x.png",
  "ios/AppIcon-76x76@2x.png",
  "ios/AppIcon-83.5x83.5@2x.png",
  "ios/AppIcon-512@2x.png",
];
const generatedIconPaths = new Set([
  ...desktopIconFiles,
  ...windowsStoreIconFiles,
  ...androidIconFiles,
  ...iosIconFiles,
]);

function readAppVersion() {
  try {
    const packageJson = JSON.parse(
      readFileSync(join(root, "package.json"), "utf8"),
    );
    return packageJson.version ?? "unknown";
  } catch {
    return "unknown";
  }
}

function commandName(command) {
  if (process.platform !== "win32") return command;

  const windowsCommands = {
    cargo: "cargo.exe",
    java: "java.exe",
    javac: "javac.exe",
    npx: "npx.cmd",
    npm: "npm.cmd",
    rustc: "rustc.exe",
    rustup: "rustup.exe",
  };
  return windowsCommands[command] ?? command;
}

function run(label, command, args) {
  console.log(`\n▶ ${label}`);
  const result = spawnSync(commandName(command), args, {
    cwd: root,
    env: buildEnv,
    shell: false,
    stdio: "inherit",
  });

  if (result.error) {
    throw new Error(`${label} failed: ${result.error.message}`);
  }
  if (result.status !== 0) {
    throw new Error(`${label} failed with exit code ${result.status ?? "unknown"}.`);
  }
}

function runTauri(label, args) {
  if (!existsSync(tauriCli)) {
    throw new Error(
      "The local Tauri CLI is missing. Run npm install before building the release.",
    );
  }
  run(label, process.execPath, [tauriCli, ...args]);
}

function runCapture(command, args) {
  return spawnSync(commandName(command), args, {
    cwd: root,
    env: buildEnv,
    encoding: "utf8",
    shell: false,
    stdio: ["ignore", "pipe", "pipe"],
  });
}

function commandAvailable(command, args) {
  const result = spawnSync(commandName(command), args, {
    cwd: root,
    env: buildEnv,
    shell: false,
    stdio: "ignore",
  });
  return !result.error && result.status === 0;
}

function findFiles(directory, predicate) {
  if (!existsSync(directory)) return [];

  const matches = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      matches.push(...findFiles(path, predicate));
    } else if (predicate(path, entry.name)) {
      matches.push(path);
    }
  }
  return matches;
}

function newest(paths) {
  return [...paths].sort((left, right) => {
    const modifiedDifference =
      statSync(right).mtimeMs - statSync(left).mtimeMs;
    return modifiedDifference || right.length - left.length;
  })[0];
}

function copyArtifact(source, destination, label) {
  if (!source || !existsSync(source)) {
    throw new Error(`${label} was not found at the expected build output.`);
  }

  copyFileSync(source, destination);
  const size = statSync(destination).size;
  if (!size) {
    throw new Error(`${label} was copied but is empty.`);
  }
  return destination;
}

function cleanReleaseDirectory() {
  mkdirSync(releaseRoot, { recursive: true });
  for (const entry of readdirSync(releaseRoot, { withFileTypes: true })) {
    rmSync(join(releaseRoot, entry.name), {
      force: true,
      recursive: entry.isDirectory(),
    });
  }
}

function cleanNativeReleaseArtifacts() {
  const targetRoot = resolve(tauriRoot, "target");
  const targetRelease = resolve(targetRoot, "release");
  const targetPrefix = `${targetRoot}${process.platform === "win32" ? "\\" : "/"}`;

  if (!targetRelease.startsWith(targetPrefix)) {
    throw new Error(`Refusing to clean an unexpected native path: ${targetRelease}`);
  }

  console.log(
    `  Cleaning generated native release artifacts: ${manifestPath(targetRelease)}`,
  );
  rmSync(targetRelease, { force: true, recursive: true });
}

function clearGeneratedIconOutputs() {
  for (const file of [...desktopIconFiles, ...windowsStoreIconFiles]) {
    rmSync(join(iconRoot, file), { force: true });
  }

  for (const directory of ["android", "ios"]) {
    rmSync(join(iconRoot, directory), { force: true, recursive: true });
  }
}

const pngSignature = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
]);

function readPngDimensions(data, label) {
  if (
    data.length < 24 ||
    !data.subarray(0, pngSignature.length).equals(pngSignature) ||
    data.toString("ascii", 12, 16) !== "IHDR"
  ) {
    throw new Error(`${label} is not a valid PNG resource.`);
  }

  return {
    width: data.readUInt32BE(16),
    height: data.readUInt32BE(20),
  };
}

function readWindowsIcon(path) {
  const data = readFileSync(path);
  if (data.length < 6) {
    throw new Error(`Windows icon is too small: ${manifestPath(path)}`);
  }

  const reserved = data.readUInt16LE(0);
  const type = data.readUInt16LE(2);
  const count = data.readUInt16LE(4);
  const tableEnd = 6 + count * 16;

  if (reserved !== 0 || type !== 1 || !count || data.length < tableEnd) {
    throw new Error(`Invalid Windows ICO header: ${manifestPath(path)}`);
  }

  const frames = [];
  for (let index = 0; index < count; index += 1) {
    const entryOffset = 6 + index * 16;
    const width = data[entryOffset] || 256;
    const height = data[entryOffset + 1] || 256;
    const byteLength = data.readUInt32LE(entryOffset + 8);
    const imageOffset = data.readUInt32LE(entryOffset + 12);
    const imageEnd = imageOffset + byteLength;

    if (imageEnd > data.length || !byteLength) {
      throw new Error(`ICO frame ${index} extends beyond the file.`);
    }

    const image = data.subarray(imageOffset, imageEnd);
    const dimensions = readPngDimensions(image, `ICO frame ${width}x${height}`);
    if (dimensions.width !== width || dimensions.height !== height) {
      throw new Error(
        `ICO frame ${index} declares ${width}x${height} but contains ` +
          `${dimensions.width}x${dimensions.height}.`,
      );
    }

    frames.push({ width, height, image });
  }

  return { data, frames };
}

function validateIconBundle() {
  const missing = [...generatedIconPaths].filter(
    (file) => !existsSync(join(iconRoot, file)),
  );
  if (missing.length) {
    throw new Error(
      [
        "Tauri icon generation completed without the required icon files.",
        `Missing: ${missing.join(", ")}`,
      ].join(" "),
    );
  }

  const stale = findFiles(iconRoot, (path) => {
    const relativePath = relative(iconRoot, path).replaceAll("\\", "/");
    return relativePath !== "focusflow.svg" && !generatedIconPaths.has(relativePath);
  });
  if (stale.length) {
    throw new Error(
      `Unexpected stale generated icon resources remain: ${stale
        .map((path) => relative(iconRoot, path).replaceAll("\\", "/"))
        .join(", ")}`,
    );
  }

  for (const [file, [width, height]] of Object.entries(desktopPngDimensions)) {
    const path = join(iconRoot, file);
    const dimensions = readPngDimensions(readFileSync(path), manifestPath(path));
    if (dimensions.width !== width || dimensions.height !== height) {
      throw new Error(
        `${manifestPath(path)} is ${dimensions.width}x${dimensions.height}; ` +
          `expected ${width}x${height}.`,
      );
    }
  }

  const icoPath = join(iconRoot, "icon.ico");
  const ico = readWindowsIcon(icoPath);
  const actualSizes = ico.frames
    .map(({ width, height }) => `${width}x${height}`)
    .sort();
  const expectedSizes = windowsIconSizes.map((size) => `${size}x${size}`).sort();
  if (
    actualSizes.length !== expectedSizes.length ||
    actualSizes.some((size, index) => size !== expectedSizes[index])
  ) {
    throw new Error(
      `Windows ICO frames are ${actualSizes.join(", ")}; expected ` +
        `${expectedSizes.join(", ")}.`,
    );
  }

  const sourceSha256 = sha256(iconSource);
  const icoSha256 = sha256(icoPath);
  console.log(`  ✓ SVG source SHA-256: ${sourceSha256}`);
  console.log(
    `  ✓ Windows ICO frames: ${actualSizes.join(", ")} (SHA-256: ${icoSha256})`,
  );
  console.log(
    `  ✓ Verified ${generatedIconPaths.size} generated desktop, Windows, Android, and iOS resources`,
  );

  return {
    sourceSha256,
    icoPath,
    icoSha256,
    frames: ico.frames,
  };
}

function regenerateIcons() {
  if (!existsSync(iconSource)) {
    throw new Error(`FocusFlow SVG icon source not found: ${iconSource}`);
  }

  clearGeneratedIconOutputs();
  runTauri("Regenerate FocusFlow icon bundle", [
    "icon",
    iconSource,
  ]);

  return validateIconBundle();
}

function copyDirectory(source, destination) {
  mkdirSync(destination, { recursive: true });
  for (const entry of readdirSync(source, { withFileTypes: true })) {
    const sourcePath = join(source, entry.name);
    const destinationPath = join(destination, entry.name);
    if (entry.isDirectory()) {
      copyDirectory(sourcePath, destinationPath);
    } else {
      copyFileSync(sourcePath, destinationPath);
    }
  }
}

function syncAndroidIcons() {
  const source = join(iconRoot, "android");
  const destination = join(androidProject, "app", "src", "main", "res");
  if (!existsSync(source) || !existsSync(destination)) {
    throw new Error(
      "Android icon resources or the initialized Android resource directory is missing.",
    );
  }

  const iconResourceDirectories = [
    "mipmap-anydpi-v26",
    ...androidDensities.map((density) => `mipmap-${density}`),
    "values",
  ];
  for (const directory of iconResourceDirectories) {
    const directoryPath = join(destination, directory);
    if (!existsSync(directoryPath)) continue;

    for (const entry of readdirSync(directoryPath, { withFileTypes: true })) {
      if (entry.isFile() && entry.name.startsWith("ic_launcher")) {
        rmSync(join(directoryPath, entry.name), { force: true });
      }
    }
  }

  copyDirectory(source, destination);

  const mismatched = androidIconFiles.filter((file) => {
    const sourcePath = join(iconRoot, file);
    const destinationPath = join(
      destination,
      file.slice("android/".length),
    );
    return (
      !existsSync(destinationPath) ||
      sha256(sourcePath) !== sha256(destinationPath)
    );
  });
  if (mismatched.length) {
    throw new Error(
      `Android icon resources were not synchronized: ${mismatched.join(", ")}`,
    );
  }
  console.log(
    `  ✓ Synchronized ${androidIconFiles.length} Android icon resources from the regenerated bundle`,
  );
}

function locateAndroidSdk() {
  const candidates = [
    buildEnv.ANDROID_HOME,
    buildEnv.ANDROID_SDK_ROOT,
    buildEnv.LOCALAPPDATA
      ? join(buildEnv.LOCALAPPDATA, "Android", "Sdk")
      : null,
    buildEnv.USERPROFILE
      ? join(buildEnv.USERPROFILE, "AppData", "Local", "Android", "Sdk")
      : null,
    join(homedir(), "AppData", "Local", "Android", "Sdk"),
  ].filter(Boolean);

  return [...new Set(candidates)].find((candidate) => existsSync(candidate)) ?? null;
}

function findAndroidSdkManager(sdk) {
  const executableNames =
    process.platform === "win32"
      ? ["sdkmanager.bat", "sdkmanager.exe"]
      : ["sdkmanager"];
  const directories = [
    join(sdk, "cmdline-tools", "latest", "bin"),
    join(sdk, "cmdline-tools", "bin"),
    join(sdk, "tools", "bin"),
  ];

  for (const directory of directories) {
    for (const executable of executableNames) {
      const candidate = join(directory, executable);
      if (existsSync(candidate)) return candidate;
    }
  }
  return null;
}

function prepareAndroidEnvironment() {
  const sdk = locateAndroidSdk();
  if (!sdk) {
    throw new Error(
      [
        "Android SDK not found.",
        "Install Android Studio and the Android SDK Command-line Tools,",
        "then set ANDROID_HOME (or ANDROID_SDK_ROOT),",
        "or install the SDK in %LOCALAPPDATA%\\Android\\Sdk.",
      ].join(" "),
    );
  }

  const sdkManager = findAndroidSdkManager(sdk);
  if (!sdkManager) {
    throw new Error(
      [
        `Android SDK was found at ${sdk}, but its Command-line Tools are missing.`,
        "Install Android SDK Command-line Tools from Android Studio's SDK Manager",
        "and rerun /build.",
      ].join(" "),
    );
  }

  buildEnv.ANDROID_HOME = sdk;
  buildEnv.ANDROID_SDK_ROOT = sdk;

  if (buildEnv.JAVA_HOME) {
    const javaBin = join(buildEnv.JAVA_HOME, "bin");
    if (!existsSync(javaBin)) {
      throw new Error(
        `JAVA_HOME points to a directory without a bin folder: ${buildEnv.JAVA_HOME}`,
      );
    }
    buildEnv.PATH = `${javaBin}${delimiter}${buildEnv.PATH ?? ""}`;
  }

  if (!commandAvailable("java", ["-version"])) {
    throw new Error(
      "Java was not found. Install a JDK (17 is recommended for Tauri Android builds) and set JAVA_HOME.",
    );
  }
  if (!commandAvailable("javac", ["-version"])) {
    throw new Error(
      "A JDK compiler was not found. Install a JDK (17 is recommended for Tauri Android builds) and set JAVA_HOME.",
    );
  }
  if (!commandAvailable("rustc", ["--version"])) {
    throw new Error(
      "Rust was not found. Install Rust with rustup before building the Android APK.",
    );
  }
  if (!commandAvailable("cargo", ["--version"])) {
    throw new Error(
      "Cargo was not found. Install the Rust toolchain with rustup before building the Android APK.",
    );
  }

  const rustup = runCapture("rustup", ["target", "list", "--installed"]);
  if (rustup.error || rustup.status !== 0) {
    throw new Error(
      [
        "Rustup could not be run to verify the Android target.",
        `Install it with: rustup target add ${androidRustTarget}`,
      ].join(" "),
    );
  }
  const installedTargets = String(rustup.stdout ?? "")
    .split(/\r?\n/)
    .map((target) => target.trim())
    .filter(Boolean);
  if (!installedTargets.includes(androidRustTarget)) {
    throw new Error(
      [
        `Rust Android target ${androidRustTarget} is not installed.`,
        `Install it with: rustup target add ${androidRustTarget}`,
      ].join(" "),
    );
  }

  return { sdk, sdkManager };
}

function assertAndroidSymlinkSupport() {
  if (process.platform !== "win32") return;

  const probeDirectory = mkdtempSync(join(root, ".focusflow-symlink-"));
  const target = join(probeDirectory, "target.txt");
  const link = join(probeDirectory, "link.txt");
  writeFileSync(target, "FocusFlow");

  try {
    symlinkSync(target, link, "file");
  } catch {
    throw new Error(
      [
        "Windows Developer Mode is required for the Android APK build.",
        "Enable it in Settings → System → For developers,",
        "or run the build terminal as Administrator, then run /build again.",
        "The portable .exe is built before this check and remains in release/.",
      ].join(" "),
    );
  } finally {
    rmSync(probeDirectory, { force: true, recursive: true });
  }
}

function verifyWindowsIconResources(executable, iconVerification) {
  const binary = readFileSync(executable);
  const missingFrames = iconVerification.frames.filter(
    ({ image }) => binary.indexOf(image) === -1,
  );

  if (missingFrames.length) {
    throw new Error(
      `The rebuilt Windows executable is missing ICO resource frames: ${missingFrames
        .map(({ width, height }) => `${width}x${height}`)
        .join(", ")}`,
    );
  }

  console.log(
    `  ✓ Embedded Windows icon resources verified in ${manifestPath(executable)}: ` +
      `${iconVerification.frames
        .map(({ width, height }) => `${width}x${height}`)
        .join(", ")}`,
  );
}

function buildPortableWindowsExe(iconVerification) {
  if (process.platform !== "win32") {
    throw new Error("The portable .exe build must run on Windows.");
  }

  const targetRelease = join(tauriRoot, "target", "release");
  cleanNativeReleaseArtifacts();
  const buildStartedAt = Date.now();

  runTauri("Build portable Windows executable", [
    "build",
    "--no-bundle",
    "--ci",
  ]);

  const candidates = findFiles(
    targetRelease,
    (path, name) =>
      name.toLowerCase().endsWith(".exe") &&
      !name.toLowerCase().includes("uninstall") &&
      !name.toLowerCase().includes("setup"),
  );
  const expected = join(targetRelease, "focusflow.exe");
  const executable = existsSync(expected)
    ? expected
    : candidates.find((path) => path.toLowerCase().endsWith("focusflow.exe")) ??
      newest(candidates);

  if (!executable) {
    throw new Error("Tauri finished, but no portable .exe was found.");
  }

  if (statSync(executable).mtimeMs < buildStartedAt) {
    throw new Error(
      `Tauri returned an older Windows executable instead of rebuilding ${manifestPath(
        executable,
      )}.`,
    );
  }
  verifyWindowsIconResources(executable, iconVerification);

  return copyArtifact(
    executable,
    join(releaseRoot, "FocusFlow-portable.exe"),
    "Portable Windows executable",
  );
}

function buildAndroidApk() {
  prepareAndroidEnvironment();
  assertAndroidSymlinkSupport();

  const androidBuildFile = join(androidProject, "app", "build.gradle.kts");
  if (!existsSync(androidBuildFile)) {
    runTauri("Initialize Android project", [
      "android",
      "init",
      "--ci",
    ]);
  }
  if (!existsSync(androidBuildFile)) {
    throw new Error(
      "Tauri Android initialization finished without creating the Android project.",
    );
  }

  syncAndroidIcons();

  const apkOutputRoot = join(androidProject, "app", "build", "outputs", "apk");
  rmSync(apkOutputRoot, { force: true, recursive: true });

  runTauri(`Build Android APK (${androidTarget})`, [
    "android",
    "build",
    "--apk",
    "--ci",
    "--target",
    androidTarget,
  ]);

  const candidates = findFiles(
    apkOutputRoot,
    (path, name) =>
      name.toLowerCase().endsWith(".apk") &&
      /[\\/]release[\\/]/i.test(path),
  );
  const apk = newest(candidates);
  if (!apk) {
    throw new Error("Android build finished, but no release .apk was found.");
  }

  return copyArtifact(
    apk,
    join(releaseRoot, `FocusFlow-android-${androidTarget}.apk`),
    "Android ARM64 APK",
  );
}

function manifestPath(path) {
  return relative(root, path).replaceAll("\\", "/");
}

function sha256(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function addArtifactToManifest(lines, label, path) {
  if (!path || !existsSync(path)) {
    lines.push(`${label}: not created`);
    return;
  }

  lines.push(
    `${label}: ${manifestPath(path)}`,
    `  Bytes: ${statSync(path).size}`,
    `  SHA-256: ${sha256(path)}`,
  );
}

function writeManifest({ executable, apk, failure, iconVerification }) {
  const status = failure ? (executable ? "partial" : "failed") : "complete";
  const iconsVerified = Boolean(iconVerification);
  const lines = [
    "FocusFlow release artifacts",
    `Build status: ${status}`,
    `Built: ${new Date().toISOString()}`,
    `Version: ${appVersion}`,
    "Android target: ARM64 (aarch64)",
    `Icon source: ${manifestPath(iconSource)}`,
    `Icon source SHA-256: ${
      iconVerification?.sourceSha256 ?? "not verified"
    }`,
    `Icon bundle: ${
      iconsVerified
        ? "verified Windows ICO frames, desktop PNGs, Windows Store, Android, and iOS resources"
        : "not verified"
    }`,
    `Windows ICO: ${
      iconVerification ? manifestPath(iconVerification.icoPath) : "not verified"
    }`,
    `Windows ICO SHA-256: ${iconVerification?.icoSha256 ?? "not verified"}`,
    `Windows ICO frames: ${
      iconVerification
        ? iconVerification.frames
            .map(({ width, height }) => `${width}x${height}`)
            .join(", ")
        : "not verified"
    }`,
    "",
    "Artifacts:",
  ];

  addArtifactToManifest(lines, "Windows portable", executable);
  addArtifactToManifest(lines, "Android APK (ARM64)", apk);

  lines.push(
    "",
    "The Windows portable build expects WebView2 Runtime on the machine.",
  );
  if (failure) {
    lines.push(
      `Failure stage: ${failure.stage}`,
      `Failure: ${failure.message.replace(/\s+/g, " ").trim()}`,
    );
  }

  writeFileSync(
    join(releaseRoot, "BUILD-MANIFEST.txt"),
    `${lines.join("\n")}\n`,
    "utf8",
  );
}

function errorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

function main() {
  cleanReleaseDirectory();

  let executable;
  let apk;
  let failure;
  let iconVerification;
  let stage = "icon preparation";

  try {
    iconVerification = regenerateIcons();
    stage = "Windows build";
    executable = buildPortableWindowsExe(iconVerification);
    stage = "Android build";
    apk = buildAndroidApk();
  } catch (error) {
    failure = { message: errorMessage(error), stage };
  }

  writeManifest({ executable, apk, failure, iconVerification });

  if (failure) {
    console.error(`\n✗ Release build stopped during ${failure.stage}.`);
    console.error(failure.message);
    if (executable) {
      console.error(
        `Windows artifact preserved: ${manifestPath(executable)}`,
      );
    }
    console.error(`Manifest: ${manifestPath(join(releaseRoot, "BUILD-MANIFEST.txt"))}`);
    process.exitCode = 1;
    return;
  }

  console.log("\n✓ Build complete");
  console.log(`  ${manifestPath(executable)}`);
  console.log(`  ${manifestPath(apk)}`);
  console.log(`  ${manifestPath(join(releaseRoot, "BUILD-MANIFEST.txt"))}`);
}

try {
  main();
} catch (error) {
  console.error("\n✗ Release build stopped.");
  console.error(errorMessage(error));
  console.error(`Check the generated files in: ${releaseRoot}`);
  process.exitCode = 1;
}
