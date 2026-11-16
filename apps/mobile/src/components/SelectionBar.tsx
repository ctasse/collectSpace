import { StyleSheet } from "react-native";
import { Appbar, Surface, Text, useTheme } from "react-native-paper";

export function SelectionBar({
  count,
  onSelectAll,
  onTag,
  onDelete,
  onClear,
}: {
  count: number;
  onSelectAll: () => void;
  onTag: () => void;
  onDelete: () => void;
  onClear: () => void;
}): JSX.Element | null {
  const theme = useTheme();
  if (count === 0) return null;

  return (
    <Surface style={[styles.bar, { backgroundColor: theme.colors.elevation.level3 }]} elevation={4}>
      <Appbar.Action icon="close" onPress={onClear} />
      <Text variant="labelLarge" style={styles.count}>
        已选 {count} 项
      </Text>
      <Appbar.Action icon="select-all" onPress={onSelectAll} accessibilityLabel="全选" />
      <Appbar.Action icon="tag-outline" onPress={onTag} accessibilityLabel="修改标签" />
      <Appbar.Action
        icon="delete-outline"
        iconColor={theme.colors.error}
        onPress={onDelete}
        accessibilityLabel="删除"
      />
    </Surface>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: "absolute",
    left: 12,
    right: 12,
    bottom: 20,
    borderRadius: 20,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 4,
  },
  count: { flex: 1 },
});
