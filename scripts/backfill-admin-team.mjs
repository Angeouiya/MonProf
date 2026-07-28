import fs from "node:fs";
import { PrismaClient } from "@prisma/client";

if (!process.env.DATABASE_URL && fs.existsSync(".env")) {
  const env = fs.readFileSync(".env", "utf8");
  const row = env.split(/\r?\n/).find((line) => line.trim().startsWith("DATABASE_URL="));
  if (row) process.env.DATABASE_URL = row.slice(row.indexOf("=") + 1).trim().replace(/^["']|["']$/g, "");
}

const prisma = new PrismaClient();
try {
  const currentOwner = await prisma.user.findFirst({
    where: { role: "ADMIN", adminTeamRole: "OWNER" },
    select: { id: true },
  });
  let initializedOwners = 0;
  if (!currentOwner) {
    const firstAdmin = await prisma.user.findFirst({
      where: { role: "ADMIN" },
      orderBy: { createdAt: "asc" },
      select: { id: true },
    });
    if (firstAdmin) {
      await prisma.user.update({
        where: { id: firstAdmin.id },
        data: { adminTeamRole: "OWNER", adminAccountStatus: "ACTIVE", adminAccessEnabled: true, adminDeletedAt: null },
      });
      initializedOwners = 1;
    }
  }
  const activeDefaults = await prisma.user.updateMany({
    where: { role: "ADMIN", adminTeamRole: null },
    data: { adminTeamRole: "SUPER_ADMIN", adminAccountStatus: "ACTIVE", adminAccessEnabled: true },
  });
  console.log(JSON.stringify({ initializedAdmins: activeDefaults.count, initializedOwners }, null, 2));
} finally {
  await prisma.$disconnect();
}
