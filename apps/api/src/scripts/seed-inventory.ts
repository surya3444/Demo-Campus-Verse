import { MongoClient, ObjectId } from 'mongodb';
import 'dotenv/config';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/campus_verse';

async function seedInventory() {
  console.log('📦 Seeding inventory data...');

  const client = new MongoClient(MONGODB_URI);

  try {
    await client.connect();
    const db = client.db();

    // Find the user
    const user = await db.collection('users').findOne({ email: 'orgdev@yopmail.com' });
    if (!user) {
      console.error('❌ User orgdev@yopmail.com not found');
      return;
    }

    const tenantId = user.tenantId;
    console.log(`✅ Found user, tenantId: ${tenantId}`);

    // Find first active branch for this tenant
    const branch = await db.collection('branches').findOne({
      tenantId,
      status: 'active',
    });
    if (!branch) {
      console.error('❌ No active branch found for this tenant');
      return;
    }

    const branchId = branch._id;
    console.log(`✅ Using branch: ${branch.name} (${branchId})`);

    const now = new Date();
    const createdBy = user._id;

    // ── Categories ──
    console.log('📂 Creating asset categories...');

    const categoryDocs = [
      {
        name: 'Electronics',
        code: 'ELEC',
        description: 'Laptops, desktops, projectors, and other electronic equipment',
      },
      {
        name: 'Furniture',
        code: 'FURN',
        description: 'Desks, chairs, tables, cabinets, and shelving',
      },
      {
        name: 'Lab Equipment',
        code: 'LAB',
        description: 'Science and computer lab instruments and apparatus',
      },
      {
        name: 'Sports Equipment',
        code: 'SPRT',
        description: 'Sports gear, fitness equipment, and outdoor items',
      },
      { name: 'Library', code: 'LIB', description: 'Books, periodicals, and reading materials' },
      { name: 'Vehicles', code: 'VEH', description: 'Buses, vans, and institutional vehicles' },
      {
        name: 'IT Infrastructure',
        code: 'ITIF',
        description: 'Servers, routers, switches, and networking gear',
      },
      {
        name: 'Maintenance Tools',
        code: 'TOOL',
        description: 'Tools and equipment for campus maintenance',
      },
    ];

    const categories: Record<string, ObjectId> = {};

    for (const cat of categoryDocs) {
      const existing = await db.collection('asset_categories').findOne({
        tenantId,
        branchId,
        code: cat.code,
      });
      if (existing) {
        categories[cat.code] = existing._id;
        console.log(`  ⏭️  Category "${cat.name}" already exists, skipping`);
      } else {
        const result = await db.collection('asset_categories').insertOne({
          tenantId,
          branchId,
          name: cat.name,
          code: cat.code,
          description: cat.description,
          parentId: null,
          createdBy,
          createdAt: now,
          updatedAt: now,
        });
        categories[cat.code] = result.insertedId;
        console.log(`  ✅ Created category: ${cat.name}`);
      }
    }

    // ── Assets ──
    console.log('🖥️  Creating assets...');

    const assetSeq = await db
      .collection('counters')
      .findOneAndUpdate(
        { tenantId, branchId, type: 'assetCode' },
        { $inc: { sequence: 0 } },
        { upsert: true, returnDocument: 'after' }
      );
    let seq = assetSeq!.sequence as number;

    const pad = (n: number) => String(n).padStart(5, '0');
    const year = new Date().getFullYear().toString().slice(-2);
    const nextCode = () => {
      seq++;
      return `AST${year}${pad(seq)}`;
    };

    const assetDocs = [
      // Electronics
      {
        name: 'Dell Latitude 5540 Laptop',
        categoryCode: 'ELEC',
        location: 'Admin Office',
        serialNumber: 'DL5540-A1001',
        modelNumber: 'Latitude 5540',
        manufacturer: 'Dell',
        purchasePrice: 72000,
        condition: 'new',
        status: 'available',
        tags: ['laptop', 'admin'],
      },
      {
        name: 'HP ProBook 450 G10 Laptop',
        categoryCode: 'ELEC',
        location: 'Staff Room',
        serialNumber: 'HP450G10-B2032',
        modelNumber: 'ProBook 450 G10',
        manufacturer: 'HP',
        purchasePrice: 65000,
        condition: 'good',
        status: 'issued',
        tags: ['laptop', 'staff'],
      },
      {
        name: 'Epson EB-X51 Projector',
        categoryCode: 'ELEC',
        location: 'Conference Hall',
        serialNumber: 'EBX51-C3045',
        modelNumber: 'EB-X51',
        manufacturer: 'Epson',
        purchasePrice: 42000,
        condition: 'good',
        status: 'available',
        tags: ['projector', 'conference'],
      },
      {
        name: 'Canon imageCLASS MF645Cx Printer',
        categoryCode: 'ELEC',
        location: 'Admin Office',
        serialNumber: 'CAN645-D4078',
        modelNumber: 'MF645Cx',
        manufacturer: 'Canon',
        purchasePrice: 38500,
        condition: 'good',
        status: 'available',
        tags: ['printer', 'admin'],
      },
      {
        name: 'Samsung 65" Smart Display',
        categoryCode: 'ELEC',
        location: 'Seminar Hall',
        serialNumber: 'SAM65-E5091',
        modelNumber: 'QA65Q60B',
        manufacturer: 'Samsung',
        purchasePrice: 89000,
        condition: 'new',
        status: 'available',
        tags: ['display', 'seminar'],
      },

      // Furniture
      {
        name: 'Executive Office Chair',
        categoryCode: 'FURN',
        location: 'Principal Office',
        modelNumber: 'EXC-200',
        manufacturer: 'Godrej',
        purchasePrice: 18500,
        condition: 'good',
        status: 'available',
        tags: ['chair', 'office'],
      },
      {
        name: 'Student Desk (Set of 30)',
        categoryCode: 'FURN',
        location: 'Classroom 101',
        modelNumber: 'SD-30',
        manufacturer: 'Nilkamal',
        purchasePrice: 75000,
        quantity: 30,
        condition: 'good',
        status: 'available',
        tags: ['desk', 'classroom'],
      },
      {
        name: 'Steel Bookshelf 6-Tier',
        categoryCode: 'FURN',
        location: 'Library',
        modelNumber: 'BS-6T',
        manufacturer: 'Godrej',
        purchasePrice: 12000,
        condition: 'fair',
        status: 'available',
        tags: ['shelf', 'library'],
      },
      {
        name: 'Wooden Conference Table (12-Seater)',
        categoryCode: 'FURN',
        location: 'Conference Hall',
        manufacturer: 'Zuari',
        purchasePrice: 45000,
        condition: 'good',
        status: 'available',
        tags: ['table', 'conference'],
      },

      // Lab Equipment
      {
        name: 'Compound Microscope (Olympus)',
        categoryCode: 'LAB',
        location: 'Biology Lab',
        serialNumber: 'OLY-CM-F6012',
        modelNumber: 'CX23',
        manufacturer: 'Olympus',
        purchasePrice: 35000,
        condition: 'good',
        status: 'available',
        tags: ['microscope', 'biology'],
      },
      {
        name: 'Digital Oscilloscope',
        categoryCode: 'LAB',
        location: 'Physics Lab',
        serialNumber: 'TEK-DS1054Z',
        modelNumber: 'DS1054Z',
        manufacturer: 'Tektronix',
        purchasePrice: 28000,
        condition: 'good',
        status: 'available',
        tags: ['oscilloscope', 'physics'],
      },
      {
        name: 'Chemistry Lab Kit (Advanced)',
        categoryCode: 'LAB',
        location: 'Chemistry Lab',
        manufacturer: 'LabIndia',
        purchasePrice: 22000,
        quantity: 5,
        condition: 'good',
        status: 'available',
        tags: ['kit', 'chemistry'],
      },

      // Sports
      {
        name: 'Basketball (Spalding Official)',
        categoryCode: 'SPRT',
        location: 'Sports Store',
        manufacturer: 'Spalding',
        purchasePrice: 3500,
        quantity: 10,
        condition: 'good',
        status: 'available',
        tags: ['basketball'],
      },
      {
        name: 'Cricket Kit (Complete Set)',
        categoryCode: 'SPRT',
        location: 'Sports Store',
        manufacturer: 'SG',
        purchasePrice: 15000,
        quantity: 3,
        condition: 'good',
        status: 'available',
        tags: ['cricket'],
      },
      {
        name: 'Table Tennis Table (Stag)',
        categoryCode: 'SPRT',
        location: 'Indoor Sports Hall',
        modelNumber: 'Championship',
        manufacturer: 'Stag',
        purchasePrice: 28000,
        condition: 'new',
        status: 'available',
        tags: ['table-tennis'],
      },

      // IT Infrastructure
      {
        name: 'Dell PowerEdge R750 Server',
        categoryCode: 'ITIF',
        location: 'Server Room',
        serialNumber: 'DPE-R750-G7023',
        modelNumber: 'R750',
        manufacturer: 'Dell',
        purchasePrice: 285000,
        condition: 'good',
        status: 'available',
        tags: ['server'],
      },
      {
        name: 'Cisco Catalyst 9200 Switch',
        categoryCode: 'ITIF',
        location: 'Server Room',
        serialNumber: 'CSC-9200-H8034',
        modelNumber: 'C9200-24T',
        manufacturer: 'Cisco',
        purchasePrice: 65000,
        condition: 'good',
        status: 'available',
        tags: ['switch', 'network'],
      },
      {
        name: 'APC Smart-UPS 3000VA',
        categoryCode: 'ITIF',
        location: 'Server Room',
        serialNumber: 'APC-3K-I9045',
        modelNumber: 'SMT3000I',
        manufacturer: 'APC',
        purchasePrice: 48000,
        condition: 'good',
        status: 'available',
        tags: ['ups', 'power'],
      },

      // Vehicles
      {
        name: 'Tata Starbus School Bus',
        categoryCode: 'VEH',
        location: 'Parking Lot',
        serialNumber: 'KA01AB1234',
        modelNumber: 'Starbus Ultra',
        manufacturer: 'Tata Motors',
        purchasePrice: 1850000,
        condition: 'good',
        status: 'available',
        tags: ['bus', 'transport'],
      },

      // Maintenance Tools
      {
        name: 'Bosch Power Drill Kit',
        categoryCode: 'TOOL',
        location: 'Maintenance Store',
        modelNumber: 'GSB 600',
        manufacturer: 'Bosch',
        purchasePrice: 4500,
        condition: 'good',
        status: 'issued',
        tags: ['drill', 'maintenance'],
      },
      {
        name: 'Pressure Washer (Karcher)',
        categoryCode: 'TOOL',
        location: 'Maintenance Store',
        modelNumber: 'K5 Premium',
        manufacturer: 'Karcher',
        purchasePrice: 22000,
        condition: 'good',
        status: 'available',
        tags: ['cleaner', 'maintenance'],
      },
    ];

    let created = 0;
    for (const asset of assetDocs) {
      const assetCode = nextCode();
      const categoryId = categories[asset.categoryCode] || null;
      const categoryName = categoryDocs.find((c) => c.code === asset.categoryCode)?.name || null;

      await db.collection('assets').insertOne({
        tenantId,
        branchId,
        assetCode,
        name: asset.name,
        description: null,
        categoryId,
        categoryName,
        location: asset.location || null,
        serialNumber: asset.serialNumber || null,
        modelNumber: asset.modelNumber || null,
        manufacturer: asset.manufacturer || null,
        purchaseDate: new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000), // random date in last year
        purchasePrice: asset.purchasePrice,
        currentValue: Math.round(asset.purchasePrice * (0.7 + Math.random() * 0.3)), // 70-100% of purchase
        warrantyExpiry: new Date(Date.now() + (1 + Math.random() * 2) * 365 * 24 * 60 * 60 * 1000), // 1-3 years from now
        condition: asset.condition,
        status: asset.status,
        assignedTo: null,
        tags: asset.tags || [],
        quantity: asset.quantity || 1,
        unit: 'piece',
        createdBy,
        createdAt: now,
        updatedAt: now,
      });
      created++;
    }

    // Update the counter so future asset codes don't collide
    await db
      .collection('counters')
      .updateOne({ tenantId, branchId, type: 'assetCode' }, { $set: { sequence: seq } });

    console.log(`  ✅ Created ${created} assets`);

    console.log('\n🎉 Inventory seed complete!');
    console.log(`   📂 ${Object.keys(categories).length} categories`);
    console.log(`   🖥️  ${created} assets`);
  } catch (error) {
    console.error('❌ Seed failed:', error);
  } finally {
    await client.close();
  }
}

seedInventory();
