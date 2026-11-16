import { ScrollView, StyleSheet, View } from "react-native";
import {
  Divider,
  List,
  Modal,
  Portal,
  Surface,
  Text,
} from "react-native-paper";
import { useItemsStore } from "../stores/items";

export function TagSheet({
  visible,
  onDismiss,
}: {
  visible: boolean;
  onDismiss: () => void;
}): JSX.Element {
  const tags = useItemsStore((state) => state.tags);
  const total = useItemsStore((state) => state.total);
  const active = useItemsStore((state) => state.tag);
  const setTagFilter = useItemsStore((state) => state.setTagFilter);

  const choose = (tag: string | null): void => {
    setTagFilter(tag);
    onDismiss();
  };

  return (
    <Portal>
      <Modal
        visible={visible}
        onDismiss={onDismiss}
        contentContainerStyle={styles.wrap}
      >
        <Surface style={styles.sheet} elevation={3}>
          <View style={styles.header}>
            <Text variant="titleMedium">按标签筛选</Text>
          </View>
          <Divider />
          <ScrollView>
            <List.Item
              title="全部收藏"
              left={(props) => <List.Icon {...props} icon="view-grid-outline" />}
              right={() => <Text>{total}</Text>}
              onPress={() => choose(null)}
              style={!active ? styles.active : undefined}
            />
            {tags.map((tag) => (
              <List.Item
                key={tag.name}
                title={tag.name}
                left={(props) => <List.Icon {...props} icon="tag-outline" />}
                right={() => <Text>{tag.count}</Text>}
                onPress={() => choose(tag.name)}
                style={active === tag.name ? styles.active : undefined}
              />
            ))}
            {tags.length === 0 && (
              <List.Item title="还没有标签" description="添加收藏时填写标签即可" />
            )}
          </ScrollView>
        </Surface>
      </Modal>
    </Portal>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: 24 },
  sheet: { borderRadius: 20, maxHeight: "75%", overflow: "hidden" },
  header: { padding: 16 },
  active: { backgroundColor: "#6750A422" },
});
