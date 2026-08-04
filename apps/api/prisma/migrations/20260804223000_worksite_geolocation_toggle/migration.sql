ALTER TABLE "WorkSite"
ADD COLUMN "geolocationEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "geolocationDisabledAt" TIMESTAMP(3),
ADD COLUMN "geolocationDisabledReason" TEXT,
ADD COLUMN "geolocationResumedAt" TIMESTAMP(3);
