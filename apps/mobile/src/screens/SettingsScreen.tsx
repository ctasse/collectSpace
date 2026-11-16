import { StyleSheet, View } from "react-native";
import * as FileSystem from "expo-file-system";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import {
  Appbar,
  Button,
  Divider,
  List,
  SegmentedButtons,
  Text,
  useTheme,
} from "react-native-paper";
import { useSettingsStore } from "../stores/settings";
import { notify, notifyError } from "../stores/ui";
import type { RootStackParamList } from "../navigation/RootNavigator";

type Nav = NativeStackNavigationProp<RootStackParamList>;

const ACCENTS = ["#6750A4", "#006A6A", "#B3261E", "#3E8260", "#7D5260"];

export function SettingsScreen(): JSX.Element {
  const navigation = useNavigation<Nav>();
  const theme = useTheme();
  const settings = useSettingsStore((state) => state.settings);
  const patch = useSettingsStore((state) => state.patch);

  const update = (value: Parameters<typeof patch>[0]): void => {
    patch(value).catch(notifyError);
  };

  const clearThumbs = async (): Promise<void> => {
    try {
      const dir = `${FileSystem.documentDirectory}thumbnails/`;
      await FileSystem.deleteAsync(dir, { idempotent: true });
      notify("缩略图缓存已清理", "success");
    } catch (caught) {
      notifyError(caught);
    }
  };

  return (
    <View style={[styles.root, { backgroundColor: theme.colors.background }]}>
      <Appbar.Header elevated>
        <Appbar.BackAction onPress={() => navigation.goBack()} />
        <Appbar.Content title="设置" />
      </Appbar.Header>

      <List.Section>
        <List.Subheader>外观</List.Subheader>
        <View style={styles.block}>
          <Text variant="labelLarge" style={styles.label}>
            主题
          </Text>
          <SegmentedButtons
            value={settings.themeMode}
            onValueChange={(value) =>
              update({ themeMode: value as "system" | "light" | "dark" })
            }
            buttons={[
              { value: "system", label: "跟随系统" },
              { value: "light", label: "浅色" },
              { value: "dark", label: "深色" },
            ]}
          />
        </View>
        <View style={styles.block}>
          <Text variant="labelLarge" style={styles.label}>
            强调色
          </Text>
          <SegmentedButtons
            value={settings.accentMode}
            onValueChange={(value) =>
              update({ accentMode: value as "system" | "custom" })
            }
            buttons={[
              { value: "system", label: "系统动态色" },
              { value: "custom", label: "自定义" },
            ]}
          />
          {settings.accentMode === "custom" && (
            <View style={styles.swatches}>
              {ACCENTS.map((color) => (
                <Button
                  key={color}
                  mode={settings.customAccent === color ? "contained" : "outlined"}
                  compact
                  buttonColor={color}
                  textColor="#fff"
                  onPress={() => update({ customAccent: color, accentMode: "custom" })}
                >
                  {color}
                </Button>
              ))}
            </View>
          )}
          <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
            Android 12+ 选择“系统动态色”时会跟随壁纸取色。
          </Text>
        </View>
      </List.Section>

      <Divider />

      <List.Section>
        <List.Subheader>数据</List.Subheader>
        <List.Item
          title="清理缩略图缓存"
          description="不会删除收藏或原始媒体文件"
          left={(props) => <List.Icon {...props} icon="broom" />}
          onPress={() => void clearThumbs()}
        />
      </List.Section>

      <Divider />

      <List.Section>
        <List.Item
          title="关于 CollectSpace"
          description="版本、数据库与开源许可"
          left={(props) => <List.Icon {...props} icon="information-outline" />}
          right={(props) => <List.Icon {...props} icon="chevron-right" />}
          onPress={() => navigation.navigate("About")}
        />
      </List.Section>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  block: { paddingHorizontal: 16, paddingBottom: 16, gap: 10 },
  label: { marginBottom: -2 },
  swatches: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
});
