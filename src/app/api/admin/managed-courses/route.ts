import { requireAdminApi } from "@/lib/admin-api";
import {
  createManagedDossier,
  ManagedCourseError,
} from "@/lib/managed-courses";
import {
  managedBody,
  managedError,
  managedGuard,
  managedResponse,
} from "@/lib/managed-courses-http";
export async function POST(request: Request) {
  try {
    managedGuard(request, true);
    const admin = await requireAdminApi("BOOKINGS_MANAGE");
    if (!admin) throw new ManagedCourseError("Accès refusé.", 403);
    return managedResponse(
      await createManagedDossier(await managedBody(request), admin.id),
    );
  } catch (error) {
    return managedError(error);
  }
}
