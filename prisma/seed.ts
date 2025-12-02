import { PrismaClient, BuyerStrategy, RehabLevel, PropertyStatus, LeadStatus } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const sampleProperty = await prisma.property.upsert({
    where: { address_ownerName: { address: '123 Main St', ownerName: 'John Doe' } },
    update: {},
    create: {
      address: '123 Main St',
      city: 'Indianapolis',
      state: 'IN',
      zip: '46218',
      ownerName: 'John Doe',
      ownerPhoneRaw: '+15555550100',
      status: PropertyStatus.NEW,
      leads: {
        create: {
          ownerName: 'John Doe',
          phone: '+15555550100',
          source: 'Seed',
          lastStatus: LeadStatus.NEW,
        },
      },
    },
  });

  await prisma.buyer.upsert({
    where: { email: 'buyer@example.com' },
    update: {},
    create: {
      name: 'Sample Buyer',
      email: 'buyer@example.com',
      phone: '+15555550200',
      city: 'Indianapolis',
      strategy: BuyerStrategy.FLIP,
      maxRehabLevel: RehabLevel.MEDIUM,
      minPrice: 50000,
      maxPrice: 200000,
      targetZips: ['46218', '46222'],
      aiBuyBoxSummary: 'Flipper focused on Indy urban core with medium rehabs up to $200k.',
    },
  });

  console.log('Seed data created:', { sampleProperty });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
