import { Client, Account, Databases, ID, Query } from "react-native-appwrite";

export const client = new Client()
    .setEndpoint(process.env.EXPO_PUBLIC_APPWRITE_ENDPOINT!)
    .setProject(process.env.EXPO_PUBLIC_APPWRITE_PROJECT_ID!)
    .setPlatform(process.env.EXPO_PUBLIC_APPWRITE_PLATFORM!);

export const account = new Account(client);
export const databases = new Databases(client);

export const DATABASE_ID = process.env.EXPO_PUBLIC_APPWRITE_DATABASE_ID!;
export const COLLECTION_ID = process.env.EXPO_PUBLIC_APPWRITE_COLLECTION_ID!; 

export { ID, Query };

/**
 * Saves a product to your pantry collection.
 * Includes user_id to ensure data privacy.
 */
export const saveToInventory = async (product: { 
    name: string; 
    barcode: string; 
    expiry?: string | null;
    user_id: string; // Added user_id
}) => {
    try {
        return await databases.createDocument(
            DATABASE_ID,
            COLLECTION_ID,
            ID.unique(),
            {
                name: product.name,
                barcode: product.barcode,
                expiry: product.expiry,
                user_id: product.user_id, // Added to payload
            }
        );
    } catch (error) {
        console.error("Appwrite Save Error:", error);
        throw error;
    }
};

/**
 * Fetches items belonging ONLY to the logged-in user.
 */
export const getPantryItems = async (userId: string) => {
    try {
        const response = await databases.listDocuments(
            DATABASE_ID,
            COLLECTION_ID,
            [
                Query.equal("user_id", userId), // Filter by user!
                Query.orderDesc('$createdAt')
            ]
        );
        return response.documents;
    } catch (error) {
        console.error("Fetch Error:", error);
        return [];
    }
};

/**
 * Deletes an item from the pantry.
 * Standard Appwrite permissions should also be set on the dashboard.
 */
export const deletePantryItem = async (documentId: string) => {
    try {
        await databases.deleteDocument(DATABASE_ID, COLLECTION_ID, documentId);
        return true;
    } catch (error) {
        console.error("Delete Error:", error);
        return false;
    }
};