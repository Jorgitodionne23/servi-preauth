module.exports = {
  expo: {
    name: "SERVI",
    slug: "servi-customer",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/images/icon.png",
    scheme: "servi",
    userInterfaceStyle: "light",
    backgroundColor: "#fafbfb",
    ios: {
      supportsTablet: false,
      bundleIdentifier: "mx.servi.app",
      googleServicesFile: process.env.GOOGLE_SERVICE_INFO_PLIST || "./GoogleService-Info.plist",
      infoPlist: {
        NSCameraUsageDescription: "SERVI usa la cámara para que tomes fotos o video del problema que quieres resolver.",
        NSMicrophoneUsageDescription: "SERVI usa el micrófono para que describas tu solicitud con una nota de voz.",
        NSPhotoLibraryUsageDescription: "SERVI accede a tus fotos para que adjuntes imágenes o videos a tu solicitud.",
        ITSAppUsesNonExemptEncryption: false,
      },
    },
    android: {
      package: "mx.servi.app",
      googleServicesFile: process.env.GOOGLE_SERVICES_JSON || "./google-services.json",
      permissions: [
        "android.permission.CAMERA",
        "android.permission.RECORD_AUDIO",
        "android.permission.MODIFY_AUDIO_SETTINGS",
        "android.permission.FOREGROUND_SERVICE",
        "android.permission.FOREGROUND_SERVICE_MEDIA_PLAYBACK",
      ],
      adaptiveIcon: {
        backgroundColor: "#eaf5f7",
        foregroundImage: "./assets/images/android-icon-foreground.png",
        backgroundImage: "./assets/images/android-icon-background.png",
        monochromeImage: "./assets/images/android-icon-monochrome.png",
      },
      predictiveBackGestureEnabled: false,
    },
    web: {
      output: "static",
      favicon: "./assets/images/favicon.png",
    },
    plugins: [
      "expo-router",
      "expo-secure-store",
      "@react-native-firebase/app",
      "@react-native-firebase/auth",
      [
        "expo-build-properties",
        {
          ios: {
            useFrameworks: "static",
          },
        },
      ],
      [
        "expo-image-picker",
        {
          photosPermission: "SERVI accede a tus fotos para que adjuntes imágenes o videos a tu solicitud.",
          cameraPermission: "SERVI usa la cámara para que tomes fotos o video del problema que quieres resolver.",
        },
      ],
      [
        "expo-audio",
        {
          microphonePermission: "SERVI usa el micrófono para que describas tu solicitud con una nota de voz.",
        },
      ],
      [
        "expo-splash-screen",
        {
          backgroundColor: "#fafbfb",
          image: "./assets/images/splash-icon.png",
          imageWidth: 120,
        },
      ],
    ],
    experiments: {
      typedRoutes: false,
      reactCompiler: true,
    },
    extra: {
      router: {},
      eas: {
        projectId: "a3316b39-2287-4d66-bde8-f2cae7fc479f",
      },
    },
  },
};
