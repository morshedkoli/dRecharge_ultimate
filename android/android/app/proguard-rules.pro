# ──────────────────────────────────────────────────────────────────────────────
# dRecharge Agent — ProGuard / R8 rules
# Applied in release builds alongside proguard-android-optimize.txt
# ──────────────────────────────────────────────────────────────────────────────


# ── Flutter engine ────────────────────────────────────────────────────────────
-keep class io.flutter.** { *; }
-keep class io.flutter.embedding.** { *; }
-keep class io.flutter.plugin.**  { *; }
-keep class io.flutter.util.**    { *; }
-keep class io.flutter.view.**    { *; }
-keep class io.flutter.plugins.** { *; }
-dontwarn io.flutter.**

# Flutter plugin registrant (generated — must not be renamed)
-keep class com.drecharge.drecharge_agent.GeneratedPluginRegistrant { *; }

# ── App native layer ──────────────────────────────────────────────────────────
# Keep every class in our package; R8 must not rename method-channel handlers
-keep class com.drecharge.drecharge_agent.** { *; }

# Accessibility service — Android OS binds this by class name via manifest
-keep class com.drecharge.drecharge_agent.UssdAccessibilityService { *; }


# ── mobile_scanner (CameraX + ZXing / ML Kit Vision) ─────────────────────────
-keep class dev.steenbakker.mobile_scanner.** { *; }
-dontwarn dev.steenbakker.mobile_scanner.**

# CameraX
-keep class androidx.camera.** { *; }
-dontwarn androidx.camera.**

# ML Kit barcode scanning
-keep class com.google.mlkit.**  { *; }
-keep class com.google.android.gms.internal.mlkit_vision_barcode.** { *; }
-dontwarn com.google.mlkit.**
-dontwarn com.google.android.gms.**

# ZXing (used as fallback scanner)
-keep class com.google.zxing.** { *; }
-dontwarn com.google.zxing.**


# ── flutter_secure_storage ────────────────────────────────────────────────────
# Uses EncryptedSharedPreferences and Android Keystore via reflection
-keep class com.it_nomads.fluttersecurestorage.** { *; }
-keep class androidx.security.crypto.** { *; }
-dontwarn com.it_nomads.fluttersecurestorage.**


# ── permission_handler ────────────────────────────────────────────────────────
-keep class com.baseflow.permissionhandler.** { *; }
-dontwarn com.baseflow.permissionhandler.**


# ── device_info_plus ──────────────────────────────────────────────────────────
-keep class dev.fluttercommunity.plus.device_info.** { *; }
-dontwarn dev.fluttercommunity.plus.device_info.**


# ── package_info_plus ─────────────────────────────────────────────────────────
-keep class dev.fluttercommunity.plus.packageinfo.** { *; }
-dontwarn dev.fluttercommunity.plus.packageinfo.**


# ── shared_preferences ────────────────────────────────────────────────────────
-keep class io.flutter.plugins.sharedpreferences.** { *; }
-dontwarn io.flutter.plugins.sharedpreferences.**


# ── http (Dart package — no native layer, but keep OkHttp if pulled in) ───────
-keep class okhttp3.** { *; }
-dontwarn okhttp3.**
-dontwarn okio.**


# ── AndroidX / Jetpack (used by CameraX, security-crypto, etc.) ──────────────
-keep class androidx.lifecycle.** { *; }
-keep class androidx.core.**      { *; }
-dontwarn androidx.**


# ── Kotlin reflection (required by coroutines / Kotlin stdlib) ────────────────
-keep class kotlin.** { *; }
-keep class kotlin.Metadata { *; }
-dontwarn kotlin.**
-keepclassmembers class **$WhenMappings { <fields>; }
-keepclassmembers class kotlin.Lazy { <methods>; }


# ── Enum classes (names used in switch/when by R8) ───────────────────────────
-keepclassmembers enum * {
    public static **[] values();
    public static ** valueOf(java.lang.String);
}


# ── Parcelable ────────────────────────────────────────────────────────────────
-keepclassmembers class * implements android.os.Parcelable {
    public static final android.os.Parcelable$Creator CREATOR;
}


# ── Serializable ─────────────────────────────────────────────────────────────
-keepclassmembers class * implements java.io.Serializable {
    private static final java.io.ObjectStreamField[] serialPersistentFields;
    private void writeObject(java.io.ObjectOutputStream);
    private void readObject(java.io.ObjectInputStream);
    java.lang.Object writeReplace();
    java.lang.Object readResolve();
}


# ── Remove logging in release builds ─────────────────────────────────────────
-assumenosideeffects class android.util.Log {
    public static int v(...);
    public static int d(...);
    public static int i(...);
}
