plugins {
    id("com.android.application")
    id("kotlin-android")
    // The Flutter Gradle Plugin must be applied after the Android and Kotlin Gradle plugins.
    id("dev.flutter.flutter-gradle-plugin")
}

// ── Per-ABI version code offsets ─────────────────────────────────────────────
// Play Store uses the highest versionCode to pick the right APK per device.
// Offset scheme: <abiCode> * 10_000 + baseVersionCode
//   armeabi-v7a → 1xxxx  (32-bit ARM, older phones)
//   arm64-v8a   → 2xxxx  (64-bit ARM, all modern phones)
//   x86_64      → 3xxxx  (emulators / Chrome OS)
val abiVersionCodes = mapOf(
    "armeabi-v7a" to 1,
    "arm64-v8a"   to 2,
    "x86_64"      to 3,
)

android {
    namespace  = "com.drecharge.drecharge_agent"
    compileSdk = flutter.compileSdkVersion
    ndkVersion = flutter.ndkVersion

    compileOptions {
        sourceCompatibility          = JavaVersion.VERSION_17
        targetCompatibility          = JavaVersion.VERSION_17
        isCoreLibraryDesugaringEnabled = true
    }

    kotlinOptions {
        jvmTarget = JavaVersion.VERSION_17.toString()
    }

    defaultConfig {
        applicationId  = "com.drecharge.drecharge_agent"
        minSdk         = flutter.minSdkVersion
        targetSdk      = flutter.targetSdkVersion
        versionCode    = flutter.versionCode
        versionName    = flutter.versionName
        multiDexEnabled = true

        // Ship only English strings — removes ~2-4 MB of unused locale data
        resourceConfigurations += "en"
    }

    buildTypes {
        release {
            // TODO: swap to a proper release signing config before publishing
            signingConfig = signingConfigs.getByName("debug")

            // ── Code shrinking & obfuscation ─────────────────────────────────
            isMinifyEnabled    = true   // R8 dead-code elimination + name mangling
            isShrinkResources  = true   // strip unused drawables/strings/layouts
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro",
            )
        }

        debug {
            isMinifyEnabled   = false
            isShrinkResources = false
        }
    }

    // ── Per-ABI APK splits ───────────────────────────────────────────────────
    // Produces one APK per ABI instead of one fat universal APK.
    // fat APK ≈ 60-100 MB   →   per-ABI APK ≈ 18-28 MB each
    //
    // Build command:
    //   flutter build apk --split-per-abi --release \
    //       --obfuscate --split-debug-info=build/debug-info
    //
    // Outputs (in build/app/outputs/flutter-apk/):
    //   app-armeabi-v7a-release.apk   ← 32-bit ARM  (older devices)
    //   app-arm64-v8a-release.apk     ← 64-bit ARM  (all modern devices)
    //   app-x86_64-release.apk        ← emulators / Chrome OS
    splits {
        abi {
            isEnable      = true
            reset()                              // clear defaults first
            include("arm64-v8a", "armeabi-v7a", "x86_64")
            isUniversalApk = false               // set true only for manual sideloads
        }
    }

    // Stamp each split APK with a unique versionCode so the Play Store and
    // manual installs always resolve the correct binary.
    @Suppress("DEPRECATION")
    applicationVariants.configureEach {
        val baseCode = versionCode
        outputs.configureEach {
            val impl = this as? com.android.build.gradle.internal.api.ApkVariantOutputImpl
            val abi  = impl?.getFilter("ABI")
            if (abi != null) {
                impl.versionCodeOverride = (abiVersionCodes[abi] ?: 0) * 10_000 + baseCode
            }
        }
    }

    // ── AAB (App Bundle) splits — used when uploading to Play Store ──────────
    bundle {
        density  { enableSplit = true }
        abi      { enableSplit = true }
        language { enableSplit = true }
    }

    // ── Strip redundant packaging metadata ───────────────────────────────────
    packaging {
        resources {
            excludes += setOf(
                "META-INF/DEPENDENCIES",
                "META-INF/LICENSE",
                "META-INF/LICENSE.txt",
                "META-INF/NOTICE",
                "META-INF/NOTICE.txt",
                "META-INF/*.kotlin_module",
                "**/*.proto",
                "**/*.kotlin_builtins",
            )
        }
    }
}

dependencies {
    coreLibraryDesugaring("com.android.tools:desugar_jdk_libs:2.1.4")
}

flutter {
    source = "../.."
}
