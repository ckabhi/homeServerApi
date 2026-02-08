/*
  Warnings:

  - You are about to drop the `_TagToTodo` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE `_TagToTodo` DROP FOREIGN KEY `_TagToTodo_A_fkey`;

-- DropForeignKey
ALTER TABLE `_TagToTodo` DROP FOREIGN KEY `_TagToTodo_B_fkey`;

-- DropTable
DROP TABLE `_TagToTodo`;

-- CreateTable
CREATE TABLE `todo_tags` (
    `todoId` VARCHAR(191) NOT NULL,
    `tagId` VARCHAR(191) NOT NULL,

    PRIMARY KEY (`todoId`, `tagId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `todo_tags` ADD CONSTRAINT `todo_tags_todoId_fkey` FOREIGN KEY (`todoId`) REFERENCES `todos`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `todo_tags` ADD CONSTRAINT `todo_tags_tagId_fkey` FOREIGN KEY (`tagId`) REFERENCES `tags`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
