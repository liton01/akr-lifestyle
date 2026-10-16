-- CreateEnum
CREATE TYPE "BannerTextTone" AS ENUM ('LIGHT', 'DARK');

-- AlterTable
ALTER TABLE "Banner" ADD COLUMN     "eyebrow" TEXT,
ADD COLUMN     "secondaryCtaLabel" TEXT,
ADD COLUMN     "secondaryLinkUrl" TEXT,
ADD COLUMN     "textTone" "BannerTextTone" NOT NULL DEFAULT 'LIGHT';
