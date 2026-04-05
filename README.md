## How to run the project in development mode
- First make sure that you are running the database server on port 5432
- Then run the following command

```bash
$ npm run start:dev
```
## How to create migration
- First make changes in schema.prisma file
- Then run the following command
```bash
$ npx prisma generate
$ npx prisma migrate dev --name <migration-name>
```
- Then run the following command to apply the migration
```bash
$ npx prisma migrate deploy
```
- Then run the following command to update the schema.prisma file
```bash
$ npx prisma generate
```

## Flat storage API updates

- `PATCH /files/:fileId/rename`
  - Updates file `displayName` only.
  - Storage `objectKey` remains unchanged.
- `PATCH /folders/:folderId/rename`
  - Updates folder `folderName` only.
  - No file move/copy in storage.
- `POST /files/download-url`
  - Uses metadata `objectKey` for file lookup.
  - Signed URL sets download filename from `displayName`.

## Flat storage migration

```bash
npx prisma migrate deploy
npx prisma generate
npx ts-node scripts/migrate-flat-storage.ts
```
