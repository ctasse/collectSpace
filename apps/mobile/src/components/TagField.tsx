import { ScrollView, StyleSheet } from "react-native";
import { Chip, TextInput } from "react-native-paper";
import { useItemsStore } from "../stores/items";

export function TagField({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}): JSX.Element {
  const tags = useItemsStore((state) => state.tags);

  return (
    <>
      <TextInput
        label="标签"
        value={value}
        onChangeText={onChange}
        mode="outlined"
        placeholder="未分类"
      />
      {tags.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.row}
        >
          {tags.slice(0, 12).map((tag) => (
            <Chip
              key={tag.name}
              compact
              selected={value === tag.name}
              onPress={() => onChange(tag.name)}
            >
              {tag.name} {tag.count}
            </Chip>
          ))}
        </ScrollView>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  row: { gap: 6, paddingVertical: 2 },
});
