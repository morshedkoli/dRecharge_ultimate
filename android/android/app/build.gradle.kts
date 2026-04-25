plugins {
    id("com.android.application")
    id("kotlin-android")
    // The Flutter Gradle Plugin must be applied after the Android and Kotlin Gradle plugins.
    id("dev.flutter.flutter-gradle-plugin")
}


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
    implementation("androidx.security:security-crypto:1.0.0")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.7.3")
}

flutter {
    source = "../.."
}
