import { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { ShareIntentProvider } from "expo-share-intent";
import { StatusBar } from "expo-status-bar";
import { PaperProvider, Snackbar } from "react-native-paper";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { initDatabase } from "./db";
import { RootNavigator } from "./navigation/RootNavigator";
import { useShareImport } from "./services/share-in";
import { useSettingsStore } from "./stores/settings";
import { useUiStore } from "./stores/ui";
import { useAppTheme } from "./theme";

function ToastHost(): JSX.Element {
  const toast = useUiStore((state) => state.toast);
  const clear = useUiStore((state) => state.clearToast);
  return (
    <Snackbar
      visible={Boolean(toast)}
      onDismiss={clear}
      duration={3600}
      action={{ label: "关闭", onPress: clear }}
      style={styles.snackbar}
    >
      {toast?.message ?? ""}
    </Snackbar>
  );
}

function ThemedApp(): JSX.Element {
  const { theme, dark } = useAppTheme();
  useShareImport();

  return (
    <PaperProvider theme={theme}>
      <StatusBar style={dark ? "light" : "dark"} />
      <RootNavigator />
      <ToastHost />
    </PaperProvider>
  );
}

export default function App(): JSX.Element {
  const loadSettings = useSettingsStore((state) => state.load);
  const [ready, setReady] = useState(false);
  const [fatal, setFatal] = useState<string | null>(null);

  useEffect(() => {
    try {
      initDatabase();
    } catch (error) {
      setFatal(error instanceof Error ? error.message : String(error));
      setReady(true);
      return;
    }
    void loadSettings().finally(() => setReady(true));
  }, [loadSettings]);

  if (!ready) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (fatal) {
    return (
      <SafeAreaProvider>
        <View style={styles.loading}>
          <Text style={styles.fatalTitle}>数据库初始化失败</Text>
          <Text style={styles.fatalText}>{fatal}</Text>
        </View>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <ShareIntentProvider options={{ debug: false }}>
        <ThemedApp />
      </ShareIntentProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, gap: 8 },
  fatalTitle: { fontSize: 18, fontWeight: "600" },
  fatalText: { textAlign: "center" },
  snackbar: { marginBottom: 88 },
});
