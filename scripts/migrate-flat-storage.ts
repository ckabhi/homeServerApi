import { PrismaClient } from '@prisma/client';
import { PathResolverHelper } from '../src/modules/files/helpers/path-resolver.helper';

const prisma = new PrismaClient();

async function migrateToFlatStorage() {
  console.log('Starting flat storage metadata migration...');

  const files = await prisma.fileMetadata.findMany({
    where: { isDeleted: false },
    select: {
      id: true,
      userId: true,
      fileName: true,
      displayName: true,
      systemFileName: true,
      isSharedFile: true,
    },
  });

  console.log(`Found ${files.length} active files to migrate`);

  let updated = 0;
  for (const file of files) {
    const displayName = file.displayName || file.fileName;
    const systemFileName =
      file.systemFileName ||
      PathResolverHelper.generateSystemFileName(displayName);
    const objectKey = PathResolverHelper.resolveObjectKeyFlat(
      file.userId,
      systemFileName,
      file.isSharedFile,
    );

    await prisma.fileMetadata.update({
      where: { id: file.id },
      data: {
        displayName,
        fileName: displayName,
        systemFileName,
        objectKey,
        updatedAt: new Date(),
      },
    });

    updated += 1;
    if (updated % 100 === 0) {
      console.log(`Migrated ${updated}/${files.length} files`);
    }
  }

  console.log(`Migration complete. Updated ${updated} files.`);
}

migrateToFlatStorage()
  .catch((error) => {
    console.error('Migration failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
