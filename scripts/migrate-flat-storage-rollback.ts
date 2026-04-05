import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function rollbackFlatStorageMigration() {
  console.log('Starting rollback using file_metadata_backup table...');

  await prisma.$executeRawUnsafe(`
    UPDATE file_metadata fm
    JOIN file_metadata_backup b ON b.id = fm.id
    SET
      fm.objectKey = b.objectKey,
      fm.fileName = b.fileName,
      fm.displayName = COALESCE(b.displayName, b.fileName),
      fm.systemFileName = b.systemFileName,
      fm.updatedAt = NOW(3)
  `);

  console.log('Rollback completed from backup table.');
}

rollbackFlatStorageMigration()
  .catch((error) => {
    console.error('Rollback failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
