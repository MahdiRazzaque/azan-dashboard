import mongoose from 'mongoose';
import * as dotenv from 'dotenv';

dotenv.config();

// Create connection
async function connectToDatabase() {
  try {
    const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/azan_app';
    
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB database');
    return mongoose.connection;
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    throw error;
  }
}

export { connectToDatabase };
