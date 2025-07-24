/*
  Warnings:

  - Added the required column `side` to the `positions` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "positions" ADD COLUMN     "closeTime" TIMESTAMP(3),
ADD COLUMN     "openTime" TIMESTAMP(3),
ADD COLUMN     "side" TEXT NOT NULL,
ADD COLUMN     "stopLoss" DOUBLE PRECISION,
ADD COLUMN     "target" DOUBLE PRECISION,
ADD COLUMN     "trailingStop" BOOLEAN DEFAULT false;
