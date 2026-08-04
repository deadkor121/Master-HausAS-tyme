CREATE TABLE "WorkerAdvance" (
    "id" TEXT NOT NULL,
    "workerId" TEXT NOT NULL,
    "amountOre" INTEGER NOT NULL,
    "advanceDate" TIMESTAMP(3) NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkerAdvance_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "WorkerAdvance"
ADD CONSTRAINT "WorkerAdvance_workerId_fkey"
FOREIGN KEY ("workerId") REFERENCES "Worker"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "WorkerAdvance_workerId_advanceDate_idx" ON "WorkerAdvance"("workerId", "advanceDate");
