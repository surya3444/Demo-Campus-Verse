import 'dotenv/config'; // load apps/api/.env so MONGODB_URI points at the real database
import bcrypt from 'bcryptjs';
import { MongoClient, ObjectId } from 'mongodb';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/campus_verse';

async function seedSuperAdmin() {
  const client = new MongoClient(MONGODB_URI);

  try {
    await client.connect();
    console.log('Connected to MongoDB');

    const db = client.db();

    // Check if super admin already exists
    const existing = await db.collection('super_admins').findOne({
      email: 'superadmin@campusverse.app',
    });

    if (existing) {
      console.log('Super admin already exists. Skipping seed.');
      return;
    }

    const passwordHash = await bcrypt.hash('SuperAdmin@123', 12);

    const superAdmin = {
      _id: new ObjectId(),
      email: 'superadmin@campusverse.app',
      passwordHash,
      profile: {
        firstName: 'Super',
        lastName: 'Admin',
        displayName: 'Super Admin',
      },
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await db.collection('super_admins').insertOne(superAdmin);

    console.log('Super admin seeded successfully!');
    console.log('Email: superadmin@campusverse.app');
    console.log('Password: SuperAdmin@123');
    console.log('\n** IMPORTANT: Change the password after first login! **');
  } catch (error) {
    console.error('Error seeding super admin:', error);
    process.exit(1);
  } finally {
    await client.close();
    console.log('Disconnected from MongoDB');
  }
}

seedSuperAdmin();
