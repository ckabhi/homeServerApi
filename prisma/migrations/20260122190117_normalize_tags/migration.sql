/*
  Warnings:

  - You are about to drop the column `tags` on the `todos` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE `todos` DROP COLUMN `tags`;

-- CreateTable
CREATE TABLE `tags` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,

    UNIQUE INDEX `tags_name_key`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `_TagToTodo` (
    `A` VARCHAR(191) NOT NULL,
    `B` VARCHAR(191) NOT NULL,

    UNIQUE INDEX `_TagToTodo_AB_unique`(`A`, `B`),
    INDEX `_TagToTodo_B_index`(`B`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `_TagToTodo` ADD CONSTRAINT `_TagToTodo_A_fkey` FOREIGN KEY (`A`) REFERENCES `tags`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `_TagToTodo` ADD CONSTRAINT `_TagToTodo_B_fkey` FOREIGN KEY (`B`) REFERENCES `todos`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
