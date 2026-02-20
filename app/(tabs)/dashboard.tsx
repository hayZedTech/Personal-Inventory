import React, { useEffect, useState } from 'react';
import { 
  View, Text, FlatList, StyleSheet, TouchableOpacity, 
  ActivityIndicator, RefreshControl, Platform, TextInput, Modal 
} from 'react-native';
import { databases, DATABASE_ID, COLLECTION_ID, Query } from '../../lib/appwrite';
import { useIsFocused } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/lib/authcontext';

export default function PantryDashboard() {
  const [items, setItems] = useState<any[]>([]);
  const [filteredItems, setFilteredItems] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const isFocused = useIsFocused();
  
  // Get both the user object and logout function from context
  const { user, logout } = useAuth();

  const [modalVisible, setModalVisible] = useState(false);
  const [selectedItem, setSelectedItem] = useState<{id: string, name: string} | null>(null);

  const loadItems = async () => {
    if (!user?.$id) {
      setLoading(false);
      setRefreshing(false);
      return;
    }

    try {
      // Corrected the attribute name to user_id
      const response = await databases.listDocuments(DATABASE_ID, COLLECTION_ID, [
        Query.equal('user_id', user.$id), 
        Query.orderDesc('$createdAt') 
      ]);
      setItems(response.documents);
      setFilteredItems(response.documents);
    } catch (error: any) {
      console.error("Fetch Error:", error.message);
      // If it still says "Attribute not found", it means the Dashboard 
      // name is different from 'user_id'
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // 3. Re-run fetch when the screen is focused OR when the user state changes
  useEffect(() => {
    if (isFocused) {
      setLoading(true);
      loadItems();
    }
  }, [isFocused, user]);

  const handleSearch = (text: string) => {
    setSearchQuery(text);
    const filtered = items.filter(item => 
      item.name.toLowerCase().includes(text.toLowerCase()) || 
      item.barcode.includes(text)
    );
    setFilteredItems(filtered);
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadItems();
  };

  const requestDelete = (id: string, name: string) => {
    setSelectedItem({ id, name });
    setModalVisible(true);
  };

  const deleteItem = async () => {
    if (!selectedItem) return;
    try {
      await databases.deleteDocument(DATABASE_ID, COLLECTION_ID, selectedItem.id);
      setModalVisible(false);
      loadItems();
    } catch (error) {
      console.error("Delete Error:", error);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.headerContainer}>
        <View style={styles.topRow}>
          <View>
            <View>
              <Text style={styles.greeting}>Stock Control</Text>
            </View>
            <Text style={styles.header}>Pantry</Text>
          </View>
          
          <View style={{flexDirection:"row", alignItems:"center", gap:40}}>
            <View style={styles.countBadge}>
              <Text style={styles.countText}>{items.length}</Text>
            </View>

            <TouchableOpacity onPress={logout} style={styles.logoutBtn}>
              <Ionicons name="log-out-outline" size={24} color="white" />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.searchSection}>
          <Ionicons name="search-outline" size={18} color="#9BA1A6" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search supplies..."
            value={searchQuery}
            onChangeText={handleSearch}
            placeholderTextColor="#9BA1A6"
          />
        </View>
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color="#007AFF" /></View>
      ) : (
        <FlatList
          data={filteredItems}
          keyExtractor={(item) => item.$id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#007AFF" />}
          renderItem={({ item }) => {
            const today = new Date();
            today.setHours(0, 0, 0, 0); 
            const expiryDate = item.expiry ? new Date(item.expiry) : null;
            
            const diffTime = expiryDate ? expiryDate.getTime() - today.getTime() : null;
            const diffDays = diffTime !== null ? Math.ceil(diffTime / (1000 * 60 * 60 * 24)) : null;
            
            const isUrgent = diffDays !== null && diffDays <= 2;

            return (
              <View style={[styles.card, isUrgent && styles.urgentBorder]}>
                <View style={styles.cardContent}>
                  <View style={styles.infoArea}>
                    <Text style={styles.name} numberOfLines={1}>{item.name}</Text>
                    <Text style={styles.barcode}>UPC: {item.barcode}</Text>
                    
                    {item.expiry && (
                      <View style={[styles.dateBadge, isUrgent && styles.urgentBadge]}>
                        <Ionicons name="time" size={12} color={isUrgent ? "#FFF" : "#007AFF"} />
                        <Text style={[styles.expiryText, isUrgent && styles.urgentText]}>
                          {isUrgent ? `Expires in ${diffDays}d` : `Exp: ${expiryDate?.toLocaleDateString()}`}
                        </Text>
                      </View>
                    )}
                  </View>
                  
                  <TouchableOpacity 
                    onPress={() => requestDelete(item.$id, item.name)}
                    style={styles.deleteIconButton}
                  >
                    <Ionicons 
                      name="trash-outline" 
                      size={22} 
                      color={isUrgent ? "#FF3B30" : "#829AB1"}
                    />
                  </TouchableOpacity>
                </View>
              </View>
            );
          }}
        />
      )}

      {/* DELETE MODAL */}
      <Modal animationType="fade" transparent={true} visible={modalVisible}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalIconBg}>
              <Ionicons name="trash-outline" size={28} color="#FF3B30" />
            </View>
            <Text style={styles.modalTitle}>Confirm Delete</Text>
            <Text style={styles.modalSubtitle}>Remove <Text style={{fontWeight: '900', color: '#102A43'}}>"{selectedItem?.name}"</Text>?</Text>
            <View style={styles.modalActionRow}>
              <TouchableOpacity style={[styles.modalButton, styles.cancelButton]} onPress={() => setModalVisible(false)}>
                <Text style={styles.cancelButtonText}>No</Text>
              </TouchableOpacity>
              <View style={{ width: 25 }} /> 
              <TouchableOpacity style={[styles.modalButton, styles.deleteButton]} onPress={deleteItem}>
                <Text style={styles.deleteButtonText}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ... styles remain the same (no changes needed to styles)
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F0F4F8', },
  headerContainer: {
    paddingHorizontal: 20, paddingTop: Platform.OS === 'ios' ? 60 : 60, paddingBottom: 20,
    backgroundColor: '#FFFFFF', borderBottomLeftRadius: 30, borderBottomRightRadius: 30,
    elevation: 8, shadowColor: 'gray', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.5, shadowRadius: 10, marginBottom:8
  },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  greeting: { fontSize: 11, color: '#007AFF', fontWeight: '800', letterSpacing: 1.5, textTransform: 'uppercase' },
  header: { fontSize: 28, fontWeight: '900', color: '#102A43' },
  countBadge: { backgroundColor: '#E1E9FF', width: 38, height: 38, borderRadius: 19, justifyContent: 'center', alignItems: 'center' },
  countText: { color: '#007AFF', fontSize: 14, fontWeight: '800' },
  logoutBtn: { 
    marginLeft: 15, 
    padding: 8, 
    backgroundColor: '#f91616', 
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FFE3E3',
  },
  searchSection: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F1F5F9', borderRadius: 15, paddingHorizontal: 15, height: 45 },
  searchInput: { flex: 1, marginLeft: 10, fontSize: 14, color: '#102A43', fontWeight: '600' },
  listContent: { padding: 15, paddingBottom: 100 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 20, marginBottom: 12, padding: 15, shadowColor: '#102A43', shadowOpacity: 0.06, shadowRadius: 8, elevation: 3, borderWidth: 1, borderColor: 'transparent' },
  urgentBorder: { borderColor: '#FF3B30', borderWidth: 1.5 },
  cardContent: { flexDirection: 'row', alignItems: 'center' },
  infoArea: { flex: 1 },
  name: { fontSize: 17, fontWeight: '800', color: '#102A43', marginBottom: 2 },
  barcode: { color: '#829AB1', fontSize: 12, marginBottom: 8, fontWeight: '600' },
  dateBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#E1E9FF', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, alignSelf: 'flex-start' },
  urgentBadge: { backgroundColor: '#FF3B30' },
  expiryText: { fontSize: 11, color: '#007AFF', marginLeft: 4, fontWeight: '800' },
  urgentText: { color: '#FFFFFF' },
  deleteIconButton: { padding: 8, backgroundColor: '#F1F5F9', borderRadius: 12 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(16, 42, 67, 0.8)', justifyContent: 'center', alignItems: 'center', padding: 30 },
  modalCard: { width: '100%', backgroundColor: '#FFF', borderRadius: 30, padding: 25, alignItems: 'center' },
  modalIconBg: { width: 60, height: 60, backgroundColor: '#FFF5F5', borderRadius: 30, justifyContent: 'center', alignItems: 'center', marginBottom: 15 },
  modalTitle: { fontSize: 22, fontWeight: '900', color: '#102A43', marginBottom: 8 },
  modalSubtitle: { fontSize: 15, color: '#627D98', textAlign: 'center', marginBottom: 25 },
  modalActionRow: { flexDirection: 'row', width: '100%' },
  modalButton: { flex: 1, height: 55, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  cancelButton: { backgroundColor: '#F0F4F8' },
  deleteButton: { backgroundColor: '#FF3B30' },
  cancelButtonText: { color: '#486581', fontWeight: '800' },
  deleteButtonText: { color: '#FFF', fontWeight: '800' },
});