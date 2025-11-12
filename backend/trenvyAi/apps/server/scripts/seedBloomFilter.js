import { refresh } from '../services/UsernameVerifier.js';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Seed Bloom Filter Script
 * Run this once on startup or periodically to refresh the Bloom filter
 */
async function seedBloomFilter() {
  try {
    console.log('Starting Bloom filter seed...');
    
    const stats = await refresh();
    
    console.log('Bloom filter seeded successfully!');
    console.log('Statistics:', stats);
    
    process.exit(0);
  } catch (error) {
    console.error('Error seeding Bloom filter:', error);
    process.exit(1);
  }
}

seedBloomFilter();
