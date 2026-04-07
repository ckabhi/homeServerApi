// import { Injectable } from "@nestjs/common";

// @Injectable()
// export class FolderTreeHelper {
//   buildFolderTree(items: { id: string; parentFolderId: string | null; folderName: string }[]) {
//     const itemMap = new Map<string, any>();
//     const roots = [];

//     // Initialize map and add children array
//     items.forEach(item => {
//       itemMap.set(item.id, { ...item, children: [] });
//     });

//     // Build tree structure
//     items.forEach(item => {
//       if (item.parentFolderId) {
//         const parent = itemMap.get(item.parentFolderId);
//         if (parent) {
//           parent.children.push(itemMap.get(item.id));
//         }
//       } else {
//         roots.push(itemMap.get(item.id));
//       }
//     });

//     return roots;
//   }
// }
