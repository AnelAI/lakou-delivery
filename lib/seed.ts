import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding database...");

  // Clear existing data
  await prisma.alert.deleteMany();
  await prisma.courierLocation.deleteMany();
  await prisma.delivery.deleteMany();
  await prisma.courier.deleteMany();

  // Create couriers
  const couriers = await Promise.all([
    prisma.courier.create({
      data: {
        name: "Mehdi Belhassen",
        phone: "+216 22 111 222",
        status: "available",
        currentLat: 36.8065,
        currentLng: 10.1815,
        lastSeen: new Date(),
        speed: 0,
      },
    }),
    prisma.courier.create({
      data: {
        name: "Sami Trabelsi",
        phone: "+216 55 333 444",
        status: "busy",
        currentLat: 36.8350,
        currentLng: 10.2100,
        lastSeen: new Date(),
        speed: 25,
      },
    }),
    prisma.courier.create({
      data: {
        name: "Khaled Mansouri",
        phone: "+216 98 555 666",
        status: "available",
        currentLat: 36.7900,
        currentLng: 10.1600,
        lastSeen: new Date(),
        speed: 0,
      },
    }),
    prisma.courier.create({
      data: {
        name: "Amine Oueslati",
        phone: "+216 25 777 888",
        status: "offline",
        currentLat: null,
        currentLng: null,
        lastSeen: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2h ago
        speed: 0,
      },
    }),
  ]);

  console.log(`✅ Created ${couriers.length} couriers`);

  // Create deliveries
  const deliveryData = [
    {
      orderNumber: `ORD-${Date.now()}-001`,
      customerName: "Fatma Zouari",
      customerPhone: "+216 71 123 456",
      pickupAddress: "Centre-ville Tunis",
      pickupLat: 36.8065,
      pickupLng: 10.1815,
      deliveryAddress: "La Marsa",
      deliveryLat: 36.8786,
      deliveryLng: 10.3249,
      status: "assigned",
      courierId: couriers[1].id,
      priority: 0,
      assignedAt: new Date(Date.now() - 20 * 60 * 1000),
      distance: 14.2,
      estimatedTime: 28,
    },
    {
      orderNumber: `ORD-${Date.now()}-002`,
      customerName: "Youssef Chaabane",
      customerPhone: "+216 71 234 567",
      pickupAddress: "Ariana",
      pickupLat: 36.8625,
      pickupLng: 10.1956,
      deliveryAddress: "El Menzah",
      deliveryLat: 36.8497,
      deliveryLng: 10.1918,
      status: "pending",
      priority: 1,
      notes: "Fragile - manipuler avec soin",
    },
    {
      orderNumber: `ORD-${Date.now()}-003`,
      customerName: "Leila Ben Salah",
      customerPhone: "+216 71 345 678",
      pickupAddress: "La Goulette",
      pickupLat: 36.8178,
      pickupLng: 10.3065,
      deliveryAddress: "Ben Arous",
      deliveryLat: 36.7527,
      deliveryLng: 10.2261,
      status: "pending",
      priority: 0,
    },
    {
      orderNumber: `ORD-${Date.now()}-004`,
      customerName: "Hatem Dridi",
      customerPhone: "+216 71 456 789",
      pickupAddress: "Manouba",
      pickupLat: 36.8095,
      pickupLng: 10.0983,
      deliveryAddress: "Ennahli",
      deliveryLat: 36.8423,
      deliveryLng: 10.2052,
      status: "delivered",
      courierId: couriers[2].id,
      priority: 0,
      assignedAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
      pickedUpAt: new Date(Date.now() - 90 * 60 * 1000),
      deliveredAt: new Date(Date.now() - 60 * 60 * 1000),
      distance: 13.8,
      estimatedTime: 27,
    },
  ];

  for (const data of deliveryData) {
    await prisma.delivery.create({ data: data as Parameters<typeof prisma.delivery.create>[0]["data"] });
  }

  console.log(`✅ Created ${deliveryData.length} deliveries`);

  // Create a sample alert for Sami (he's been "paused")
  await prisma.alert.create({
    data: {
      courierId: couriers[1].id,
      type: "unauthorized_pause",
      message: `${couriers[1].name} est immobile depuis 7 minutes`,
      severity: "warning",
      resolved: false,
    },
  });

  console.log("✅ Created sample alert");
  console.log("\n🎉 Seed complete! Couriers:");
  couriers.forEach((c) => {
    console.log(`  - ${c.name} (${c.status}) — Tracking page: http://localhost:3000/courier/${c.id}`);
  });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
