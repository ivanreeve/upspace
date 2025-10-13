import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();  

async function main() {

  const users = await prisma.test.create({ data: { name: 'asdasdad', }, });
  console.log(users);

  };



main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });