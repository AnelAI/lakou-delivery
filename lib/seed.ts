import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding database...");

  // Clear existing data
  await prisma.alert.deleteMany();
  await prisma.courierLocation.deleteMany();
  await prisma.delivery.deleteMany();
  await prisma.courier.deleteMany();

  // Create couriers — Bizerte
  const couriers = await Promise.all([
    prisma.courier.create({
      data: {
        name: "Mehdi Belhassen",
        phone: "+216 22 111 222",
        status: "available",
        currentLat: 37.2744,
        currentLng: 9.8739,
        lastSeen: new Date(),
        speed: 0,
      },
    }),
    prisma.courier.create({
      data: {
        name: "Sami Trabelsi",
        phone: "+216 55 333 444",
        status: "busy",
        currentLat: 37.2511,
        currentLng: 9.8481,
        lastSeen: new Date(),
        speed: 28,
      },
    }),
    prisma.courier.create({
      data: {
        name: "Khaled Mansouri",
        phone: "+216 98 555 666",
        status: "available",
        currentLat: 37.2756,
        currentLng: 9.8686,
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
        lastSeen: new Date(Date.now() - 2 * 60 * 60 * 1000),
        speed: 0,
      },
    }),
  ]);

  console.log(`✅ Created ${couriers.length} couriers`);

  // Create deliveries — quartiers de Bizerte
  const deliveryData = [
    {
      orderNumber: `ORD-${Date.now()}-001`,
      customerName: "Fatma Zouari",
      customerPhone: "+216 72 123 456",
      pickupAddress: "Centre-ville Bizerte",
      pickupLat: 37.2744,
      pickupLng: 9.8739,
      deliveryAddress: "Zarzouna",
      deliveryLat: 37.2511,
      deliveryLng: 9.8481,
      status: "assigned",
      courierId: couriers[1].id,
      priority: 0,
      assignedAt: new Date(Date.now() - 20 * 60 * 1000),
      distance: 3.5,
      estimatedTime: 12,
    },
    {
      orderNumber: `ORD-${Date.now()}-002`,
      customerName: "Youssef Chaabane",
      customerPhone: "+216 72 234 567",
      pickupAddress: "Port de Bizerte",
      pickupLat: 37.2756,
      pickupLng: 9.8686,
      deliveryAddress: "Remel",
      deliveryLat: 37.2920,
      deliveryLng: 9.8530,
      status: "pending",
      priority: 1,
      notes: "Fragile — manipuler avec soin",
    },
    {
      orderNumber: `ORD-${Date.now()}-003`,
      customerName: "Leila Ben Salah",
      customerPhone: "+216 72 345 678",
      pickupAddress: "Corniche Bizerte",
      pickupLat: 37.2780,
      pickupLng: 9.8620,
      deliveryAddress: "Menzel Bourguiba",
      deliveryLat: 37.1532,
      deliveryLng: 9.7987,
      status: "pending",
      priority: 0,
    },
    {
      orderNumber: `ORD-${Date.now()}-004`,
      customerName: "Hatem Dridi",
      customerPhone: "+216 72 456 789",
      pickupAddress: "El Azib",
      pickupLat: 37.2100,
      pickupLng: 9.8450,
      deliveryAddress: "Ras Jebel",
      deliveryLat: 37.2167,
      deliveryLng: 10.1167,
      status: "delivered",
      courierId: couriers[2].id,
      priority: 0,
      assignedAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
      pickedUpAt: new Date(Date.now() - 90 * 60 * 1000),
      deliveredAt: new Date(Date.now() - 60 * 60 * 1000),
      distance: 22.4,
      estimatedTime: 35,
    },
  ];

  for (const data of deliveryData) {
    await prisma.delivery.create({ data: data as Parameters<typeof prisma.delivery.create>[0]["data"] });
  }

  console.log(`✅ Created ${deliveryData.length} deliveries`);

  // Alerte exemple pour Sami
  await prisma.alert.create({
    data: {
      courierId: couriers[1].id,
      type: "unauthorized_pause",
      message: `${couriers[1].name} est immobile depuis 7 minutes (Zarzouna)`,
      severity: "warning",
      resolved: false,
    },
  });

  console.log("✅ Created sample alert");
  console.log("\n🎉 Seed complet ! Coursiers :");
  couriers.forEach((c) => {
    console.log(`  - ${c.name} (${c.status}) — http://localhost:3000/courier/${c.id}`);
  });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
