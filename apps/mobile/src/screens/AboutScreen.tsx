import { useEffect, useState } from "react";
import { Linking, ScrollView, StyleSheet, View } from "react-native";
import Constants from "expo-constants";
import * as FileSystem from "expo-file-system";
import { useNavigation } from "@react-navigation/native";
import {
  Appbar,
  Divider,
  List,
  Text,
  useTheme,
} from "react-native-paper";
import { getDbInfo, type DbInfo } from "../db";
import { notifyError } from "../stores/ui";

const REPO = "https://github.com/ctasse/collectSpace";

export function AboutScreen(): JSX.Element {
  const navigation = useNavigation();
  const theme = useTheme();
  const [info, setInfo] = useState<DbInfo | null>(null);

  useEffect(() => {
    try {
      setInfo(getDbInfo());
    } catch {
      setInfo(null);
    }
  }, []);

  return (
    <View style={[styles.root, { backgroundColor: theme.colors.background }]}>
      <Appbar.Header elevated>
        <Appbar.BackAction onPress={() => navigation.goBack()} />
        <Appbar.Content title="关于" />
      </Appbar.Header>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.hero}>
          <Text variant="headlineSmall">CollectSpace</Text>
          <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
            版本 {Constants.expoConfig?.version ?? "2.0.0"}
          </Text>
          <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
            收藏文本、链接、图片、视频与文件
          </Text>
        </View>

        <Divider />

        <List.Section>
          <List.Subheader>数据</List.Subheader>
          <List.Item
            title="数据库"
            description={info?.path ?? "未初始化"}
            descriptionNumberOfLines={3}
            left={(props) => <List.Icon {...props} icon="database-outline" />}
          />
          <List.Item
            title="Schema 版本"
            description={info ? `v${info.schemaVersion}` : "—"}
            left={(props) => <List.Icon {...props} icon="layers-outline" />}
          />
          <List.Item
            title="媒体目录"
            description={`${FileSystem.documentDirectory ?? ""}media/`}
            descriptionNumberOfLines={3}
            left={(props) => <List.Icon {...props} icon="folder-outline" />}
          />
        </List.Section>

        <Divider />

        <List.Section>
          <List.Subheader>说明</List.Subheader>
          <List.Item
            title="旧版数据"
            description="移动端不读取旧版私有目录数据；如需迁移，请先在 Windows 桌面版导入。"
            descriptionNumberOfLines={4}
            left={(props) => <List.Icon {...props} icon="information-outline" />}
          />
          <List.Item
            title="开源仓库"
            description={REPO}
            descriptionNumberOfLines={2}
            left={(props) => <List.Icon {...props} icon="github" />}
            onPress={() => Linking.openURL(REPO).catch(notifyError)}
          />
          <List.Item
            title="许可证"
            description="MIT License"
            left={(props) => <List.Icon {...props} icon="license" />}
          />
        </List.Section>

        <Text
          variant="bodySmall"
          style={[styles.footer, { color: theme.colors.onSurfaceVariant }]}
        >
          Material 3 · Expo · SQLite
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { paddingBottom: 32 },
  hero: { padding: 24, gap: 4 },
  footer: { textAlign: "center", marginTop: 24 },
});
