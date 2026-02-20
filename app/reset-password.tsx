import { useState } from "react";
import { View, StyleSheet, Alert, KeyboardAvoidingView, Platform } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useAuth } from "@/lib/authcontext";
import { TextInput, Button, Text, Surface } from "react-native-paper";

export default function ResetPasswordScreen() {
  const { confirmPasswordReset } = useAuth();
  const router = useRouter();
  
  const { userId, secret } = useLocalSearchParams<{ userId: string; secret: string }>();

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!userId || !secret) {
      Alert.alert("Error", "Missing reset information.");
      return;
    }

    if (newPassword.length < 8) {
        Alert.alert("Error", "Password must be at least 8 characters.");
        return;
    }

    if (newPassword !== confirmPassword) {
        Alert.alert("Error", "Passwords do not match.");
        return;
    }

    setLoading(true);
    const error = await confirmPasswordReset(userId, secret, newPassword);
    setLoading(false);

    if (error) {
      Alert.alert("Error", error);
    } else {
      Alert.alert("Success", "Password updated successfully!", [
        { text: "Login Now", onPress: () => router.replace("/auth") } 
      ]);
    }
  };

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={styles.container}
    >
      <Surface style={styles.card} elevation={4}>
        <View style={styles.iconCircle}>
            <TextInput.Icon icon="lock-reset" size={40} color="#2563eb" />
        </View>

        <Text variant="headlineSmall" style={styles.header}>Reset Password</Text>
        <Text variant="bodyMedium" style={styles.subtitle}>
            Enter a strong new password to secure your account.
        </Text>

        <TextInput
          label="New Password"
          mode="outlined"
          secureTextEntry={!showPassword}
          value={newPassword}
          onChangeText={setNewPassword}
          style={styles.input}
          outlineColor="#e2e8f0"
          activeOutlineColor="#2563eb"
          placeholder="Min. 8 characters"
          right={
            <TextInput.Icon 
              icon={showPassword ? "eye-off" : "eye"} 
              onPress={() => setShowPassword(!showPassword)} 
              forceTextInputFocus={false}
            />
          }
        />

        <TextInput
          label="Confirm New Password"
          mode="outlined"
          secureTextEntry={!showPassword}
          value={confirmPassword}
          onChangeText={setConfirmPassword}
           style={styles.input}
          outlineColor="#e2e8f0"
          activeOutlineColor="#2563eb"
          right={
            <TextInput.Icon 
              icon={showPassword ? "eye-off" : "eye"} 
              onPress={() => setShowPassword(!showPassword)} 
              forceTextInputFocus={false}
            />
          }
          placeholder="Repeat password"
        />

        <Button 
          mode="contained"
          onPress={handleSubmit} 
          loading={loading}
          disabled={loading || !newPassword || !confirmPassword}
          style={styles.button}
          contentStyle={styles.buttonContent}
         
        >
          Update Password
        </Button>
      </Surface>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: "#f8fafc", 
    justifyContent: "center", 
    padding: 20 
  },
  card: {
    padding: 24,
    borderRadius: 20,
    backgroundColor: "white",
    alignItems: 'stretch'
  },
  iconCircle: {
    alignSelf: 'center',
    backgroundColor: '#eff6ff',
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16
  },
  header: { 
    fontWeight: "bold", 
    marginBottom: 8, 
    textAlign: "center",
    color: "#1e293b"
  },
  subtitle: {
    textAlign: "center",
    color: "#64748b",
    marginBottom: 24,
    lineHeight: 20
  },
  input: { 
    marginBottom: 16,
    backgroundColor: "white" 
  },
  button: {
    marginTop: 8,
    borderRadius: 12,
    color:"white",
    backgroundColor: "#80f"
  },
  buttonContent: {
    paddingVertical: 10,
  }
});