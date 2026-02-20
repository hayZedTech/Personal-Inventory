import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

export default function TabLayout() {
  return (
    <Tabs screenOptions={{ 
      tabBarActiveTintColor: '#007AFF',
      headerShown: false, 
      tabBarStyle: { height: 120, paddingBottom: 10 }
    }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Scanner',
          tabBarIcon: ({ color }) => <Ionicons name="barcode-outline" size={28} color={color} />,
        }}
      />
      <Tabs.Screen
        name="dashboard"
        options={{
          title: 'My Pantry',
          tabBarIcon: ({ color }) => <Ionicons name="fast-food-outline" size={28} color={color} />,
        }}
      />
    </Tabs>
  );
}