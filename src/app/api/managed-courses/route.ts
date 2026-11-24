import { createManagedDossier } from "@/lib/managed-courses";
import {
  managedBody,
  managedError,
  managedGuard,
  managedResponse,
} from "@/lib/managed-courses-http";
export async function POST(request: Request) {
  try {
    managedGuard(request, true);
    const result = await createManagedDossier(await managedBody(request));
    // No public dossier ID, phone lookup or personal details exposed.
    return managedResponse({
      reference: result.reference,
      path: "path" in result ? result.path : undefined,
    });
  } catch (error) {
    return managedError(error);
  }
}
