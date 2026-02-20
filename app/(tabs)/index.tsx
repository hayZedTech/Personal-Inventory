import DateTimePicker from "@react-native-community/datetimepicker";
import { CameraView, useCameraPermissions } from "expo-camera";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import "react-native-url-polyfill/auto";

// Updated imports to include 'account'
import {
  COLLECTION_ID,
  DATABASE_ID,
  databases,
  Query,
  saveToInventory,
  account, 
} from "../../lib/appwrite";

export default function InventoryApp() {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [loading, setLoading] = useState(false);

  const [productName, setProductName] = useState("");
  const [barcode, setBarcode] = useState("");
  const [expiryDate, setExpiryDate] = useState(new Date());
  const [useExpiry, setUseExpiry] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [viewMode, setViewMode] = useState<"scanner" | "form">("scanner");

  if (!permission) return <View style={styles.base} />;

  if (!permission.granted) {
    return (
      <View style={styles.center}>
        <Text style={styles.infoText}>
          Camera access is needed to scan barcodes.
        </Text>
        <TouchableOpacity
          style={styles.primaryButton}
          onPress={requestPermission}
        >
          <Text style={styles.buttonText}>Enable Camera</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const fetchProductData = async (data: string) => {
    setLoading(true);
    setBarcode(data);

    try {
      // 1. Get current User ID first
      const user = await account.get();
      const userId = user.$id;

      // 2. Check YOUR Appwrite 'pantry_inventory' table FOR THIS USER ONLY
      const localCheck = await databases.listDocuments(
        DATABASE_ID,
        COLLECTION_ID,
        [
            Query.equal("barcode", data),
            Query.equal("user_id", userId) // Important: Filter by user
        ],
      );

      if (localCheck.documents.length > 0) {
        const existingItem = localCheck.documents[0];
        setProductName(existingItem.name);
        
        if (existingItem.expiry) {
            setExpiryDate(new Date(existingItem.expiry));
            setUseExpiry(true);
        }
        console.log("✅ Found in your Pantry:", existingItem.name);
      } else {
        // 3. FALLBACK: Check Global Open Food Facts API
        const response = await fetch(
          `https://world.openfoodfacts.org/api/v2/product/${data}.json`,
        );
        const result = await response.json();

        if (result.status === 1 && result.product) {
          const name =
            result.product.product_name ||
            result.product.product_name_en ||
            result.product.generic_name ||
            "";
          setProductName(name);
        } else {
          setProductName(""); 
        }
      }
      setViewMode("form");
    } catch (error) {
      console.log("🌐 Error fetching data. Continuing to manual entry.");
      setViewMode("form");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!productName) {
      Alert.alert("Required", "Please provide a name for this product.");
      return;
    }

    setLoading(true);
    try {
      // 1. Get current user
      const user = await account.get();
      const userId = user.$id;

      // 2. Check if item exists for this specific user
      const check = await databases.listDocuments(DATABASE_ID, COLLECTION_ID, [
        Query.equal("barcode", barcode),
        Query.equal("user_id", userId)
      ]);

      const payload = {
        name: productName,
        barcode: barcode,
        expiry: useExpiry ? expiryDate.toISOString() : null,
        user_id: userId, // Added column
      };

      if (check.documents.length > 0) {
        // UPDATE
        const docId = check.documents[0].$id;
        await databases.updateDocument(DATABASE_ID, COLLECTION_ID, docId, payload);
        Alert.alert("Updated", `${productName} has been updated in your pantry.`);
      } else {
        // CREATE
        await saveToInventory(payload);
        Alert.alert("Success", `${productName} added to your cloud pantry!`);
      }

      reset();
    } catch (error) {
      console.error(error);
      Alert.alert(
        "Error",
        "Check your 'user_id' attribute in Appwrite Dashboard.",
      );
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setScanned(false);
    setViewMode("scanner");
    setProductName("");
    setUseExpiry(false);
    setBarcode("");
    setExpiryDate(new Date());
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={styles.base}
    >
      {viewMode === "scanner" ? (
        <View style={styles.container}>
          <CameraView
            onBarcodeScanned={
              scanned
                ? undefined
                : ({ data }) => {
                    setScanned(true);
                    fetchProductData(data);
                  }
            }
            style={StyleSheet.absoluteFillObject}
          />
          <View style={styles.overlay}>
            <View style={styles.scanGuideline} />
            <Text style={styles.scanText}>Scanning for items...</Text>
          </View>

          {loading && (
            <View style={styles.loadingOverlay}>
              <ActivityIndicator size="large" color="#fff" />
              <Text style={styles.loadingText}>Searching Database...</Text>
            </View>
          )}
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.formContainer}>
          <Text style={styles.label}>PRODUCT IDENTIFIED</Text>
          <TextInput
            style={styles.mainInput}
            value={productName}
            onChangeText={setProductName}
            placeholder="Enter Product Name"
            placeholderTextColor="#999"
          />

          <View style={styles.card}>
            <Text style={styles.cardLabel}>Barcode Number</Text>
            <Text style={styles.cardValue}>{barcode}</Text>
          </View>

          <View style={[styles.card, { marginTop: 20 }]}>
            <View style={styles.row}>
              <Text style={styles.cardLabel}>Set Expiration Date?</Text>
              <TouchableOpacity
                style={[styles.toggle, useExpiry && styles.toggleOn]}
                onPress={() => setUseExpiry(!useExpiry)}
              >
                <View
                  style={[styles.toggleCircle, useExpiry && styles.circleOn]}
                />
              </TouchableOpacity>
            </View>

            {useExpiry && (
              <TouchableOpacity
                onPress={() => setShowDatePicker(true)}
                style={styles.dateSelector}
              >
                <Text style={styles.dateText}>{expiryDate.toDateString()}</Text>
              </TouchableOpacity>
            )}
          </View>

          {showDatePicker && (
            <DateTimePicker
              value={expiryDate}
              mode="date"
              display={Platform.OS === "ios" ? "spinner" : "default"}
              onChange={(event, selectedDate) => {
                setShowDatePicker(false);
                if (selectedDate) setExpiryDate(selectedDate);
              }}
            />
          )}

          <TouchableOpacity
            style={[styles.saveButton, loading && { opacity: 0.7 }]}
            onPress={handleSave}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <Text style={styles.saveButtonText}>Confirm & Sync Pantry</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity onPress={reset} style={styles.cancelLink}>
            <Text style={styles.cancelText}>Cancel & Scan Again</Text>
          </TouchableOpacity>
        </ScrollView>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  base: { flex: 1, backgroundColor: "#F8F9FA" },
  container: { flex: 1, backgroundColor: "#000" },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 30,
  },
  infoText: { textAlign: "center", marginBottom: 20, color: "#666" },
  primaryButton: { backgroundColor: "#007AFF", padding: 15, borderRadius: 10 },
  buttonText: { color: "#fff", fontWeight: "bold" },
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  scanGuideline: {
    width: 280,
    height: 170,
    borderWidth: 2,
    borderColor: "#007AFF",
    borderRadius: 15,
  },
  scanText: { color: "#fff", marginTop: 20, fontWeight: "700", fontSize: 16 },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.8)",
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: { color: "#fff", marginTop: 10, fontWeight: "bold" },
  formContainer: { padding: 25, paddingTop: 60 },
  label: {
    fontSize: 12,
    fontWeight: "800",
    color: "#007AFF",
    letterSpacing: 1,
  },
  mainInput: {
    fontSize: 26,
    fontWeight: "bold",
    color: "#1A1A1A",
    marginVertical: 15,
    paddingBottom: 5,
    borderBottomWidth: 2,
    borderBottomColor: "#E9ECEF",
  },
  card: {
    backgroundColor: "#FFF",
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#EEE",
  },
  cardLabel: {
    fontSize: 13,
    color: "#6C757D",
    fontWeight: "600",
    marginBottom: 5,
  },
  cardValue: { fontSize: 16, color: "#212529", fontWeight: "500" },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  toggle: {
    width: 50,
    height: 28,
    borderRadius: 15,
    backgroundColor: "#DEE2E6",
    padding: 2,
  },
  toggleOn: { backgroundColor: "#34C759" },
  toggleCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#FFF",
  },
  circleOn: { alignSelf: "flex-end" },
  dateSelector: {
    marginTop: 15,
    padding: 12,
    backgroundColor: "#F1F3F5",
    borderRadius: 8,
    alignItems: "center",
  },
  dateText: { color: "#007AFF", fontWeight: "700" },
  saveButton: {
    backgroundColor: "#039d0d",
    padding: 20,
    borderRadius: 16,
    marginTop: 40,
    alignItems: "center",
  },
  saveButtonText: { color: "#FFF", fontSize: 18, fontWeight: "bold" },
  cancelLink: { marginTop: 40, alignItems: "center" },
  cancelText: { 
    backgroundColor: "#E9ECEF", 
    color: "#495057", 
    fontSize: 16, 
    fontWeight: "bold",  
    paddingVertical: 12, 
    paddingHorizontal: 25, 
    borderRadius: 12, 
  },
});