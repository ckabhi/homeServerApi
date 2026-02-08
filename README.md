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
$ npx prisma migrate dev --name init
```
- Then run the following command to apply the migration
```bash
$ npx prisma migrate deploy
```
- Then run the following command to update the schema.prisma file
```bash
$ npx prisma generate
```