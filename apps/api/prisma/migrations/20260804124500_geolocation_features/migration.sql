-- CreateTable
CREATE TABLE "WorkSite" (
    "id" TEXT NOT NULL,
    "workerId" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "radiusMeters" DOUBLE PRECISION NOT NULL DEFAULT 5,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "leftAt" TIMESTAMP(3),
    "lastPingAt" TIMESTAMP(3),
    "lastPingLatitude" DOUBLE PRECISION,
    "lastPingLongitude" DOUBLE PRECISION,
    "lastDistanceMeters" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkSite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkSitePing" (
    "id" TEXT NOT NULL,
    "workSiteId" TEXT NOT NULL,
    "workerId" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "accuracyMeters" DOUBLE PRECISION,
    "distanceMeters" DOUBLE PRECISION NOT NULL,
    "isInside" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkSitePing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkPhotoReport" (
    "id" TEXT NOT NULL,
    "workerId" TEXT NOT NULL,
    "workSiteId" TEXT,
    "workDate" TIMESTAMP(3) NOT NULL,
    "photoUrl" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkPhotoReport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WorkSite_workerId_isActive_startedAt_idx" ON "WorkSite"("workerId", "isActive", "startedAt");

-- CreateIndex
CREATE INDEX "WorkSitePing_workerId_createdAt_idx" ON "WorkSitePing"("workerId", "createdAt");

-- CreateIndex
CREATE INDEX "WorkSitePing_workSiteId_createdAt_idx" ON "WorkSitePing"("workSiteId", "createdAt");

-- CreateIndex
CREATE INDEX "WorkPhotoReport_workerId_workDate_idx" ON "WorkPhotoReport"("workerId", "workDate");

-- AddForeignKey
ALTER TABLE "WorkSite" ADD CONSTRAINT "WorkSite_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "Worker"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkSitePing" ADD CONSTRAINT "WorkSitePing_workSiteId_fkey" FOREIGN KEY ("workSiteId") REFERENCES "WorkSite"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkSitePing" ADD CONSTRAINT "WorkSitePing_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "Worker"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkPhotoReport" ADD CONSTRAINT "WorkPhotoReport_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "Worker"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkPhotoReport" ADD CONSTRAINT "WorkPhotoReport_workSiteId_fkey" FOREIGN KEY ("workSiteId") REFERENCES "WorkSite"("id") ON DELETE SET NULL ON UPDATE CASCADE;
