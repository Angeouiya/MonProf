import fs from "node:fs";
import { PrismaClient } from "@prisma/client";

if (!process.env.DATABASE_URL && fs.existsSync(".env")) {
  const env = fs.readFileSync(".env", "utf8");
  const row = env.split(/\r?\n/).find((line) => line.trim().startsWith("DATABASE_URL="));
  if (row) process.env.DATABASE_URL = row.slice(row.indexOf("=") + 1).trim().replace(/^["']|["']$/g, "");
}

const prisma = new PrismaClient();
try {
  const activeDefaults = await prisma.user.updateMany({
    where: { role: "ADMIN", adminTeamRole: null },
    data: { adminTeamRole: "SUPER_ADMIN", adminAccountStatus: "ACTIVE", adminAccessEnabled: true },
  });
  const owner = await prisma.user.updateMany({
    where: { role: "ADMIN", email: { equals: "angeouiya@gmail.com", mode: "insensitive" } },
    data: { adminTeamRole: "OWNER", adminAccountStatus: "ACTIVE", adminAccessEnabled: true, adminDeletedAt: null },
  });
  console.log(JSON.stringify({ initializedAdmins: activeDefaults.count, initializedOwners: owner.count }, null, 2));
} finally {
  await prisma.$disconnect();
}
