-- Create Enums
CREATE TYPE "PropertyStatus" AS ENUM ('NEW','CONTACTED','WARM','HOT','UNDER_CONTRACT','DEAD');
CREATE TYPE "LeadStatus" AS ENUM ('NEW','ATTEMPTED','QUALIFIED_WARM','QUALIFIED_HOT','NOT_INTERESTED','DO_NOT_CALL');
CREATE TYPE "CallDirection" AS ENUM ('OUTBOUND','INBOUND');
CREATE TYPE "BuyerStrategy" AS ENUM ('FLIP','BRRRR','RENTAL','WHOLESALE');
CREATE TYPE "RehabLevel" AS ENUM ('COSMETIC','MEDIUM','HEAVY');
CREATE TYPE "DealStatus" AS ENUM ('OPEN','ASSIGNED','CLOSED','CANCELED');

-- Property
CREATE TABLE "Property" (
  "id" TEXT PRIMARY KEY,
  "propstreamId" TEXT,
  "address" TEXT NOT NULL,
  "city" TEXT NOT NULL,
  "state" TEXT NOT NULL,
  "zip" TEXT NOT NULL,
  "beds" INTEGER,
  "baths" DOUBLE PRECISION,
  "sqft" INTEGER,
  "yearBuilt" INTEGER,
  "ownerName" TEXT,
  "ownerMailingAddr" TEXT,
  "ownerPhoneRaw" TEXT,
  "equityEstimate" DOUBLE PRECISION,
  "arvEstimate" DOUBLE PRECISION,
  "motivationScore" INTEGER,
  "status" "PropertyStatus" NOT NULL DEFAULT 'NEW',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Lead
CREATE TABLE "Lead" (
  "id" TEXT PRIMARY KEY,
  "propertyId" TEXT NOT NULL REFERENCES "Property"("id") ON DELETE CASCADE,
  "ownerName" TEXT,
  "phone" TEXT NOT NULL,
  "source" TEXT NOT NULL,
  "lastStatus" "LeadStatus" NOT NULL DEFAULT 'NEW',
  "lastCallResult" TEXT,
  "aiNotes" TEXT,
  "motivationScore" INTEGER,
  "priceExpectation" DOUBLE PRECISION,
  "timeline" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CallAttempt
CREATE TABLE "CallAttempt" (
  "id" TEXT PRIMARY KEY,
  "leadId" TEXT NOT NULL REFERENCES "Lead"("id") ON DELETE CASCADE,
  "when" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "direction" "CallDirection" NOT NULL,
  "result" TEXT NOT NULL,
  "transcript" TEXT,
  "aiSummary" TEXT
);

-- Buyer
CREATE TABLE "Buyer" (
  "id" TEXT PRIMARY KEY,
  "name" TEXT NOT NULL,
  "company" TEXT,
  "email" TEXT,
  "phone" TEXT,
  "city" TEXT,
  "notes" TEXT,
  "minPrice" DOUBLE PRECISION,
  "maxPrice" DOUBLE PRECISION,
  "targetZips" TEXT[] NOT NULL,
  "strategy" "BuyerStrategy",
  "maxRehabLevel" "RehabLevel",
  "aiBuyBoxSummary" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Deal
CREATE TABLE "Deal" (
  "id" TEXT PRIMARY KEY,
  "propertyId" TEXT NOT NULL REFERENCES "Property"("id") ON DELETE CASCADE,
  "contractPrice" DOUBLE PRECISION NOT NULL,
  "arv" DOUBLE PRECISION,
  "estimatedRepairs" DOUBLE PRECISION,
  "assignmentFee" DOUBLE PRECISION,
  "status" "DealStatus" NOT NULL DEFAULT 'OPEN',
  "aiSummary" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- DispoMatch
CREATE TABLE "DispoMatch" (
  "id" TEXT PRIMARY KEY,
  "dealId" TEXT NOT NULL REFERENCES "Deal"("id") ON DELETE CASCADE,
  "buyerId" TEXT NOT NULL REFERENCES "Buyer"("id") ON DELETE CASCADE,
  "matchScore" INTEGER NOT NULL,
  "sentVia" TEXT,
  "sentAt" TIMESTAMP(3),
  "buyerResponse" TEXT
);

-- Constraints
CREATE UNIQUE INDEX "Property_address_ownerName_key" ON "Property"("address", "ownerName");
CREATE UNIQUE INDEX "Buyer_email_key" ON "Buyer"("email");
