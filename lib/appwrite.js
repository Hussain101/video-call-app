// lib/appwrite.js
import { Client, Databases, ID, Query } from 'appwrite';

const client = new Client();

client
  .setEndpoint('https://cloud.appwrite.io/v1')
  .setProject('6762f0da001455410a1a');

export const databases = new Databases(client);

// Configuration constants
const DATABASE_ID = '65fd0c0f3b64197a45d2'; // Replace with your actual database ID
const COLLECTION_ID = '6795b46d001f9dba39a5';

// Database service for room/user data
export class RoomService {
  async saveRoomEntry(meetingUrl, roomId, callerId, receiverId,callerName) {
    try {
      // Step 1: Check if callerId already exists
      const existing = await databases.listDocuments(
        DATABASE_ID,
        COLLECTION_ID,
        [Query.equal('callerId', callerId)]
      );

      
        // Step 3: Create new document
        const response = await databases.createDocument(
          DATABASE_ID,
          COLLECTION_ID,
          ID.unique(),
          {
            meetingUrl,
            room: roomId,
            callerId,
            calleeIds:receiverId,
            callerName,
            
          }
        );
        console.log('Room entry saved:', response);
        return response;
      
    } catch (error) {
      console.error('Error saving room entry:', error);
      throw error;
    }
  }

  async getRoomEntries(roomId = null) {
    try {
      let queries = [];
      if (roomId) {
        queries = [Query.equal('room', roomId)]; // ✅ fixed field name ("room" not "roomId")
      }

      const response = await databases.listDocuments(
        DATABASE_ID,
        COLLECTION_ID,
        queries
      );
      return response;
    } catch (error) {
      console.error('Error fetching room entries:', error);
      throw error;
    }
  }

  async updateStatusByCallerId(callerId, status) {
    try {
      // Find the document with the given callerId
      const existing = await databases.listDocuments(
        DATABASE_ID,
        COLLECTION_ID,
        [Query.equal('callerId', callerId)]
      );

      if (existing.total > 0) {
        const documentId = existing.documents[0].$id;
        const response = await databases.updateDocument(
          DATABASE_ID,
          COLLECTION_ID,
          documentId,
          { status }
        );
        console.log('Status updated:', response);
        return response;
      } else {
        throw new Error('No document found for this callerId');
      }
    } catch (error) {
      console.error('Error updating status:', error);
      throw error;
    }
  }
}

const roomService = new RoomService();
export default roomService;
