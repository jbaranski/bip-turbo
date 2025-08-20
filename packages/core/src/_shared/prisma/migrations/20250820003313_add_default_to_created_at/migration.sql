/*
  Warnings:

  - Made the column `user_id` on table `users_roles` required. This step will fail if there are existing NULL values in that column.
  - Made the column `role_id` on table `users_roles` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "tracks" ALTER COLUMN "created_at" SET DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "users_roles" ALTER COLUMN "user_id" SET NOT NULL,
ALTER COLUMN "role_id" SET NOT NULL,
ADD CONSTRAINT "users_roles_pkey" PRIMARY KEY ("user_id", "role_id");

-- AddForeignKey
ALTER TABLE "users_roles" ADD CONSTRAINT "users_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users_roles" ADD CONSTRAINT "users_roles_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
