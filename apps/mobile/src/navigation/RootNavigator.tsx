import {
  DarkTheme as NavDarkTheme,
  DefaultTheme as NavLightTheme,
  NavigationContainer,
  type Theme as NavTheme,
} from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useTheme } from "react-native-paper";
import { CollectionScreen } from "../screens/CollectionScreen";
import { SearchScreen } from "../screens/SearchScreen";
import { SettingsScreen } from "../screens/SettingsScreen";
import { AboutScreen } from "../screens/AboutScreen";

export type RootStackParamList = {
  Collection: undefined;
  Search: undefined;
  Settings: undefined;
  About: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator(): JSX.Element {
  const theme = useTheme();
  const navTheme: NavTheme = {
    ...(theme.dark ? NavDarkTheme : NavLightTheme),
    colors: {
      ...(theme.dark ? NavDarkTheme.colors : NavLightTheme.colors),
      primary: theme.colors.primary,
      background: theme.colors.background,
      card: theme.colors.surface,
      text: theme.colors.onSurface,
      border: theme.colors.outlineVariant,
      notification: theme.colors.error,
    },
  };

  return (
    <NavigationContainer theme={navTheme}>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Collection" component={CollectionScreen} />
        <Stack.Screen name="Search" component={SearchScreen} />
        <Stack.Screen name="Settings" component={SettingsScreen} />
        <Stack.Screen name="About" component={AboutScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
