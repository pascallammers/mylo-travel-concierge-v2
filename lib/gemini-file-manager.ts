import { GoogleAIFileManager, FileState } from '@google/generative-ai/server';

if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
  throw new Error('GOOGLE_GENERATIVE_AI_API_KEY is not set');
}

const fileManager = new GoogleAIFileManager(process.env.GOOGLE_GENERATIVE_AI_API_KEY);

export interface GeminiFile {
  name: string;
  displayName: string;
  mimeType: string;
  sizeBytes: string;
  createTime: string;
  updateTime: string;
  expirationTime: string;
  uri: string;
  state: FileState;
}

export class GeminiFileManager {
  static async uploadFile(path: string, displayName: string, mimeType: string) {
    try {
      const uploadResponse = await fileManager.uploadFile(path, {
        mimeType,
        displayName,
      });
      
      console.log(`Uploaded file ${displayName} as: ${uploadResponse.file.name}`);
      return uploadResponse.file;
    } catch (error) {
      console.error('Error uploading file to Gemini:', error);
      throw error;
    }
  }

  static async listFiles() {
    try {
      const listFilesResponse = await fileManager.listFiles();
      return listFilesResponse.files;
    } catch (error) {
      console.error('Error listing files from Gemini:', error);
      throw error;
    }
  }

  static async deleteFile(name: string) {
    try {
      await fileManager.deleteFile(name);
      console.log(`Deleted file ${name}`);
    } catch (error) {
      console.error('Error deleting file from Gemini:', error);
      throw error;
    }
  }

  static async getFile(name: string) {
    try {
      const file = await fileManager.getFile(name);
      return file;
    } catch (error) {
      console.error('Error getting file from Gemini:', error);
      throw error;
    }
  }
}
