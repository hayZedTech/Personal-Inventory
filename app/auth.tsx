import { useAuth } from "@/lib/authcontext";
import { useState, useEffect } from "react";
import { 
    KeyboardAvoidingView, 
    Platform, 
    StyleSheet, 
    View, 
    TouchableOpacity, 
    Switch, 
    Alert, 
    Modal, 
    Linking,
    ScrollView 
} from "react-native";
import { Button, Text, TextInput } from "react-native-paper";
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';

export default function AuthPage() {
    const [isSignup, setIsSignup] = useState<boolean>(false);
    const [email, setEmail] = useState<string>("");
    const [password, setPassword] = useState<string>("");
    const [rememberMe, setRememberMe] = useState<boolean>(true);
    const [secureText, setSecureText] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState<boolean>(false);
    const [isBiometricSupported, setIsBiometricSupported] = useState(false);
    
    // State for multi-account support - explicitly initialized as empty array
    const [savedAccounts, setSavedAccounts] = useState<string[]>([]);
    
    const [helpModalVisible, setHelpModalVisible] = useState(false);

    const WHATSAPP_NUMBER = "+2348072178062"; 
    const CALL_NUMBER = "+2348072178062";     

    const { signUp, signIn, forgotPassword } = useAuth();

    useEffect(() => {
        (async () => {
            const compatible = await LocalAuthentication.hasHardwareAsync();
            const enrolled = await LocalAuthentication.isEnrolledAsync();
            setIsBiometricSupported(compatible && enrolled);
            
            try {
                const savedEmail = await SecureStore.getItemAsync('user_email');
                if (savedEmail) setEmail(savedEmail);

                const accountsJson = await SecureStore.getItemAsync('saved_accounts');
                if (accountsJson) {
                    const parsed = JSON.parse(accountsJson);
                    // Safety check: Ensure parsed data is actually an array
                    if (Array.isArray(parsed)) {
                        setSavedAccounts(parsed);
                    }
                }
            } catch (e) {
                console.log("Error loading saved data from SecureStore");
            }
        })();
    }, []);

    const handleContact = (type: 'whatsapp' | 'call') => {
        let url = type === 'whatsapp' 
            ? `whatsapp://send?phone=${WHATSAPP_NUMBER}&text=Hello, I need help with my account.`
            : `tel:${CALL_NUMBER}`;

        Linking.canOpenURL(url).then((supported) => {
            if (supported) {
                Linking.openURL(url);
            } else {
                Alert.alert("Error", "This option is not available on your device.");
            }
        });
    };

    const handleForgotPassword = async () => {
        if (!email) {
            setError("Please enter your email address first.");
            return;
        }
        Alert.alert(
            "Reset Password",
            `Send a reset link to ${email}?`,
            [
                { text: "Cancel", style: "cancel" },
                { 
                    text: "Send", 
                    onPress: async () => {
                        const resError = await forgotPassword(email);
                        if (resError) setError(resError);
                        else Alert.alert("Success", "Check your email for the recovery link!");
                    } 
                }
            ]
        );
    };

    const removeAccount = async (emailToRemove: string) => {
        Alert.alert(
            "Remove Account",
            `Forget ${emailToRemove} on this device?`,
            [
                { text: "Cancel", style: "cancel" },
                { 
                    text: "Remove", 
                    style: "destructive",
                    onPress: async () => {
                        try {
                            const updatedAccounts = (savedAccounts || []).filter(acc => acc !== emailToRemove);
                            setSavedAccounts(updatedAccounts);
                            await SecureStore.setItemAsync('saved_accounts', JSON.stringify(updatedAccounts));
                            
                            const storageKey = `pass_${emailToRemove.replace(/[^a-zA-Z0-9]/g, '_')}`;
                            await SecureStore.deleteItemAsync(storageKey);
                            
                            if (email === emailToRemove) setEmail("");
                        } catch (e) {
                            console.error("Error removing account:", e);
                        }
                    } 
                }
            ]
        );
    };

    const handleBiometricAuth = async (targetEmail?: string) => {
        const emailToUse = targetEmail || email;
        const cleanEmail = emailToUse.toLowerCase().trim();

        if (!cleanEmail) {
            setError("Please type your email to use fingerprint.");
            return;
        }

        const result = await LocalAuthentication.authenticateAsync({
            promptMessage: `Sign in as ${cleanEmail}`,
            fallbackLabel: "Use Passcode",
        });

        if (result.success) {
            setLoading(true);
            try {
                const storageKey = `pass_${cleanEmail.replace(/[^a-zA-Z0-9]/g, '_')}`;
                const savedPass = await SecureStore.getItemAsync(storageKey);

                if (savedPass) {
                    const resultError = await signIn(cleanEmail, savedPass);
                    if (resultError) {
                        setError(resultError);
                    } else {
                        // Success: Move this account to the front of the list
                        updateAccountOrder(cleanEmail);
                    }
                } else {
                    setError(`No saved profile for ${cleanEmail}. Please login manually once.`);
                }
            } catch (e: any) {
                setError(`Storage access failed: ${e.message || 'Unknown Error'}`);
            } finally {
                setLoading(false);
            }
        }
    };

    // Helper to move most recent email to front
    const updateAccountOrder = async (recentEmail: string) => {
        try {
            const existingAccountsStr = await SecureStore.getItemAsync('saved_accounts');
            let accountsArray: string[] = [];
            if (existingAccountsStr) {
                const parsed = JSON.parse(existingAccountsStr);
                if (Array.isArray(parsed)) accountsArray = parsed;
            }

            // Remove email if it exists, then add to the beginning
            const filtered = accountsArray.filter(acc => acc !== recentEmail);
            const updated = [recentEmail, ...filtered];
            
            await SecureStore.setItemAsync('saved_accounts', JSON.stringify(updated));
            setSavedAccounts(updated);
        } catch (e) {
            console.error("Failed to update account order:", e);
        }
    };

    const handleSubmit = async () => {
        const cleanEmail = email.toLowerCase().trim();
        if (!cleanEmail || !password) {
            setError("Fields cannot be empty!");
            return;
        }

        setLoading(true);
        setError(null);

        const resultError = isSignup ? await signUp(cleanEmail, password) : await signIn(cleanEmail, password);
        
        if (!resultError) {
            if (rememberMe) {
                try {
                    const storageKey = `pass_${cleanEmail.replace(/[^a-zA-Z0-9]/g, '_')}`;
                    await SecureStore.setItemAsync('user_email', cleanEmail);
                    await SecureStore.setItemAsync(storageKey, password);
                    await updateAccountOrder(cleanEmail);
                } catch (e) {
                    console.error("Failed to save to SecureStore:", e);
                }
            }
        }

        if (resultError) setError(resultError);
        setLoading(false);
    };

    return (
        <KeyboardAvoidingView 
            style={styles.container} 
            behavior={Platform.OS == "ios" ? "padding" : "height"}
        >
            <Modal
                animationType="slide"
                transparent={true}
                visible={helpModalVisible}
                onRequestClose={() => setHelpModalVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>How can we help?</Text>
                        <Text style={styles.modalSubtitle}>Contact our support team directly</Text>
                        
                        <TouchableOpacity 
                            style={[styles.contactButton, { backgroundColor: '#25D366' }]} 
                            onPress={() => handleContact('whatsapp')}
                        >
                            <MaterialCommunityIcons name="whatsapp" size={24} color="white" />
                            <Text style={styles.contactButtonText}>WhatsApp Us</Text>
                        </TouchableOpacity>

                        <TouchableOpacity 
                            style={[styles.contactButton, { backgroundColor: '#007AFF' }]} 
                            onPress={() => handleContact('call')}
                        >
                            <MaterialCommunityIcons name="phone" size={24} color="white" />
                            <Text style={styles.contactButtonText}>Call Support</Text>
                        </TouchableOpacity>

                        <Button 
                            mode="text" 
                            onPress={() => setHelpModalVisible(false)}
                            textColor="#666"
                        >
                            Close
                        </Button>
                    </View>
                </View>
            </Modal>

            <View style={styles.card}>
                <View style={styles.headerIcon}>
                    <MaterialCommunityIcons 
                        name={isSignup ? "account-plus" : "lock-reset"} 
                        size={50} 
                        color="#2E7D32" 
                    />
                </View>

                <Text style={styles.title} variant="headlineMedium">
                    {isSignup ? "Create Account" : "Welcome Back"}
                </Text>

                {!isSignup && Array.isArray(savedAccounts) && savedAccounts.length > 0 && (
                    <View style={styles.accountSelector}>
                        <Text style={styles.accountLabel}>Recent Accounts:</Text>
                        <ScrollView 
                            horizontal 
                            showsHorizontalScrollIndicator={false} 
                            contentContainerStyle={styles.accountScroll}
                            alwaysBounceHorizontal={true}
                        >
                            {savedAccounts.map((savedEmail) => (
                                <View key={savedEmail} style={styles.accountWrapper}>
                                    <TouchableOpacity 
                                        style={styles.accountChip}
                                        onPress={() => {
                                            setEmail(savedEmail);
                                            handleBiometricAuth(savedEmail);
                                        }}
                                    >
                                        <View style={styles.accountAvatar}>
                                            <Text style={styles.avatarText}>{savedEmail ? savedEmail[0].toUpperCase() : '?'}</Text>
                                        </View>
                                        <Text numberOfLines={1} style={styles.accountChipText}>{savedEmail.split('@')[0]}</Text>
                                    </TouchableOpacity>
                                    
                                    <TouchableOpacity 
                                        style={styles.removeBadge} 
                                        onPress={() => removeAccount(savedEmail)}
                                    >
                                        <MaterialCommunityIcons name="close-circle" size={18} color="#FF3B30" />
                                    </TouchableOpacity>
                                </View>
                            ))}
                        </ScrollView>
                    </View>
                )}
                
                <TextInput 
                    onChangeText={setEmail} 
                    value={email}
                    style={styles.inputs} 
                    label="Email" 
                    autoCapitalize="none" 
                    mode="outlined" 
                    outlineStyle={styles.inputOutline}
                    left={<TextInput.Icon icon="email-outline" />}
                />

                <TextInput 
                    onChangeText={setPassword} 
                    value={password}
                    style={styles.inputs} 
                    label="Password" 
                    secureTextEntry={secureText} 
                    mode="outlined" 
                    outlineStyle={styles.inputOutline}
                    left={<TextInput.Icon icon="lock-outline" />}
                    right={<TextInput.Icon icon={secureText ? "eye" : "eye-off"} onPress={() => setSecureText(!secureText)} />}
                />

                <View style={styles.forgotPassRow}>
                    {!isSignup && (
                        <TouchableOpacity onPress={handleForgotPassword}>
                            <Text style={styles.forgotPassText}>Forgot Password?</Text>
                        </TouchableOpacity>
                    )}
                    
                    {!isSignup && (
                        <TouchableOpacity onPress={() => setHelpModalVisible(true)}>
                            <Text style={styles.forgotPassText}>Help?</Text>
                        </TouchableOpacity>
                    )}
                </View>

                {!isSignup && (
                    <View style={styles.rememberMeRow}>
                        <View style={styles.toggleGroup}>
                            <Switch 
                                value={rememberMe} 
                                onValueChange={setRememberMe} 
                                trackColor={{ false: "#D1D1D6", true: "#80f5" }}
                                thumbColor={rememberMe ? "#80f" : "#F4F3F4"}
                            />
                            <Text style={styles.rememberText}>Remember Me</Text>
                        </View>
                    </View>
                )}

                {error && (
                    <View style={styles.errorBox}>
                        <MaterialCommunityIcons name="alert-circle" size={16} color="white" />
                        <Text style={styles.errorText}>{error}</Text>
                    </View>
                )}

                <Button 
                    onPress={handleSubmit} 
                    style={styles.mainButton} 
                    mode="contained"
                    loading={loading}
                    disabled={loading}
                >
                    {/* {isSignup ? "Sign Up" : "Sign In"} */}
                    {loading ? "" : (isSignup ? "Sign Up" : "Sign In")}
                </Button>

                {!isSignup && isBiometricSupported && (
                    <View style={styles.biometricContainer}>
                        <Text style={styles.biometricText}>Quick Sign In</Text>
                        <TouchableOpacity onPress={() => handleBiometricAuth()} style={styles.biometricCircle}>
                            <MaterialCommunityIcons name="fingerprint" size={40} color="#80f" />
                        </TouchableOpacity>
                    </View>
                )}

                <Button onPress={() => setIsSignup(!isSignup)} style={styles.switchButton} mode="text" textColor="#666">
                    {isSignup ? "Already have an account? Sign In" : "Don't have an account? Sign Up"}
                </Button>
            </View>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, padding: 20, justifyContent: "center", backgroundColor: "#F2F2F7" },
    card: { backgroundColor: "#fff", padding: 25, borderRadius: 30, elevation: 10 },
    headerIcon: { alignItems: 'center', marginBottom: 10 },
    title: { textAlign: "center", fontWeight: "900", color: "#1C1C1E", marginBottom: 20 },
    accountSelector: { marginBottom: 15 },
    accountLabel: { fontSize: 12, color: '#666', marginBottom: 8, marginLeft: 5 },
    accountScroll: { flexDirection: 'row', paddingRight: 10 },
    accountWrapper: { position: 'relative', marginRight: 12, paddingTop: 5, paddingRight: 5 },
    accountChip: { 
        alignItems: 'center', 
        backgroundColor: '#f0f0f0', 
        padding: 8, 
        borderRadius: 12, 
        width: 80 
    },
    removeBadge: {
        position: 'absolute',
        top: -2,
        right: -2,
        backgroundColor: 'white',
        borderRadius: 10,
    },
    accountAvatar: { 
        width: 35, 
        height: 35, 
        borderRadius: 18, 
        backgroundColor: '#80f', 
        justifyContent: 'center', 
        alignItems: 'center',
        marginBottom: 4
    },
    avatarText: { color: 'white', fontWeight: 'bold' },
    accountChipText: { fontSize: 10, color: '#333' },
    inputs: { marginBottom: 10, backgroundColor: '#fff' },
    inputOutline: { borderRadius: 15 },
    forgotPassRow: { 
        flexDirection: 'row', 
        justifyContent: "space-between", 
        marginBottom: 15 
    },
    forgotPassText: { color: "#80f", fontWeight: '700', fontSize: 13 },
    rememberMeRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 15 },
    toggleGroup: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    rememberText: { fontSize: 14, color: "#80f", fontWeight: '500' },
    errorBox: { flexDirection: 'row', alignItems: 'center', gap: 5, justifyContent: 'center', marginBottom: 10, backgroundColor: '#f00e', padding: 10, borderRadius: 15 },
    errorText: { color: "white", fontSize: 13, fontWeight: '600', textAlign: 'center' },
    mainButton: { marginTop: 5, borderRadius: 15, backgroundColor: "#80f" },
    biometricContainer: { alignItems: 'center', marginTop: 20 },
    biometricText: { color: '#8E8E93', fontSize: 12, marginBottom: 10 },
    biometricCircle: { padding: 12, borderRadius: 50, backgroundColor: '#80f2', borderWidth: 1, borderColor:"#80f" },
    switchButton: { marginTop: 24 },
    modalOverlay: { 
        flex: 1, 
        backgroundColor: 'rgba(0,0,0,0.5)', 
        justifyContent: 'center', 
        alignItems: 'center' 
    },
    modalContent: { 
        width: '80%', 
        backgroundColor: 'white', 
        borderRadius: 25, 
        padding: 25, 
        alignItems: 'center' 
    },
    modalTitle: { fontSize: 20, fontWeight: '800', marginBottom: 5 },
    modalSubtitle: { fontSize: 14, color: '#666', marginBottom: 20 },
    contactButton: { 
        flexDirection: 'row', 
        alignItems: 'center', 
        padding: 15, 
        borderRadius: 15, 
        width: '100%', 
        marginBottom: 10,
        justifyContent: 'center',
        gap: 10
    },
    contactButtonText: { color: 'white', fontWeight: 'bold', fontSize: 16 }
});