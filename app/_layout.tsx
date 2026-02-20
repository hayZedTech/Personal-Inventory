import { Stack, useRouter, useSegments } from "expo-router";
import { useEffect } from "react";
import AuthProvider, { useAuth } from "@/lib/authcontext";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { PaperProvider } from "react-native-paper";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { ActivityIndicator, View, StatusBar } from "react-native"; // Added StatusBar import
import * as SplashScreen from "expo-splash-screen";
import { useFonts } from "expo-font";

// 1. Prevent the splash screen from auto-hiding immediately
SplashScreen.preventAutoHideAsync();

function RouteGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { user, isLoading } = useAuth();
  const segments = useSegments();

  useEffect(() => {
    const currentSegments = segments as any;

    // 1. Safety check: Don't run logic while auth is checking storage
    if (isLoading || !currentSegments) return;

    const rootSegment = currentSegments[0]; 
    
    // 2. Identify where the user is
    const inAuthGroup = rootSegment === "auth" || currentSegments.includes("auth");
    
    // Explicitly check for 'reset-password' in the URL segments
    const isResettingPassword = rootSegment === "reset-password" || currentSegments.includes("reset-password");

    // 3. LOGIC: If we are on the reset-password page, PAUSE all redirects. 
    if (isResettingPassword) {
        return; 
    }
 
    // 4. Standard Redirects
    if (!user && !inAuthGroup) {
        router.replace("/auth");
    } else if (user && inAuthGroup) {
        router.replace("/");
    }
  }, [user, segments, isLoading]);

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" color="#0000ff" />
      </View>
    );
  }

  return <>{children}</>;
}

export default function RootLayout() {
  const [loaded, error] = useFonts({
    // Add your fonts here if needed
  });

  useEffect(() => {
    if (loaded || error) {
      SplashScreen.hideAsync();
    }
  }, [loaded, error]);

  if (!loaded && !error) {
    return null;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <PaperProvider>
        <SafeAreaProvider>
          {/* This line makes the status bar icons dark (visible on white) */}
          <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent={true} />
          
          <AuthProvider>
            <RouteGuard>
              <Stack screenOptions={{ headerShown: false }}>
                <Stack.Screen name="(tabs)" />
                <Stack.Screen name="auth" />
                <Stack.Screen name="reset-password" />
              </Stack>
            </RouteGuard>
          </AuthProvider>
        </SafeAreaProvider>
      </PaperProvider>
    </GestureHandlerRootView>
  );
}